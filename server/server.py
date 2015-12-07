# Python game server

import asyncio
import websockets
from game_model import GameState

# Represents a "session"
# This will serve as lobbies that players join to play together
# This maintains information of the players, the game state, etc.
class Session:
	# Initialize the session object
	def __init__(self, sID):
		# The session ID
		self.sessionID = sID
		# Game state of the session
		self.gameState = GameState()
		# Usernames
		self.player1 = ''
		self.player2 = ''
		self.ready = False

	def setPlayer1(self, player):
		self.player1 = player

	def setPlayer2(self, player):
		self.player2 = player

# Handles the server function
# Websocket messages are handled by this class
class GameServer:

	# Creates a response in JSON
	def createResponse(self, cmd, data):
		return '{"resp":{"cmd":"' + cmd + '","data":' + data + '}}'

	def login(self, data):
		return self.createResponse("login", "OK")

	# Creates a Session for the player requesting
	# updates the sessions array and the sID
	def createSession(self, data):
		print ("Creating Session: " + str(self.currentSID))
		session = Session(self.currentSID)
		session.setPlayer1(data)
		self.sessions[self.currentSID] = session
		self.currentSID = self.currentSID + 1
		return self.createResponse("sID", str(session.sessionID))

	# Join an existing session
	# Message: {join_session: user,sID}
	def joinSession(self, data):
		pDat = data.split(',')
		user = pDat[0]
		sID = int(pDat[1])
		print (user + " is trying to join session " + pDat[1])

		# Join a random session if the session ID provided by user is -1
		if sID == -1:
			for cID in self.sessions:
				if (self.sessions[cID].player2 == ''):
					sID = cID
		
		if sID in self.sessions:
			# Join specific session
			op = self.sessions[sID].player1
			self.sessions[sID].setPlayer2(user)
			self.sessions[sID].ready = True
			print("Joined successfully!")
			return self.createResponse("joined","\"" + op + "," + str(sID) + "\"")
		else:
			return self.createResponse("join_failed","\"No session with ID:" + data + " found.\"")

	# Parses the Session object and Game State into an update JSON string
	# message {player1:_, player2:_, p1board:_, p2board:_, turn:1/2, phase:bluffmove(1)/predict(2)}
	def parseUpdate(self, sID):
		cSession = self.sessions[sID]
		# Add player names to update
		resp = "{\"player1\":\"" + cSession.player1 + "\",\"player2\":\"" + cSession.player2 + "\","
		# Add board states
		resp = resp + "\"p1board\":" + str(cSession.gameState.p1board) 
		resp = resp + ",\"p2board\":" + str(cSession.gameState.p2board) + ","
		resp = resp + "\"turn\":" + str(cSession.gameState.currentPlayer) + ","
		resp = resp + "\"phase\":"
		if (cSession.gameState.state == GameState.State.BluffMove):
			resp = resp + "1"
		else:
			resp = resp + "2"
		resp = resp + ",\"win\":" + str(cSession.gameState.checkWin())
		resp = resp + "}"
		return resp

	# Updates a client with current information
	# Like players who joined the room, game state, etc
	# Message: {update: user, sID}
	def updateSession(self, data):
		sID = int(data)
		if sID in self.sessions:
			update = self.parseUpdate(sID)
			print ("Update message: " + update);
			return self.createResponse("update", update)
		else:
			return self.createResponse("update_fail", "\"Incorrect Session ID\"")

	# Adds a bluff and move of the current player in the game
	# Message received: {sID, playerN, move_x, move_y, bluff_x, bluff_y}
	def addBluffAndMoveToSession(self, data):
		splitData = data.split(',')
		sID = int(splitData[0])
		playerN = int(splitData[1])
		moveX = int(splitData[2])
		moveY = int(splitData[3])
		move = (moveX, moveY)
		bluffX = int(splitData[4])
		bluffY = int(splitData[5])
		bluff = (bluffX, bluffY)
		if sID in self.sessions:
			cSession = self.sessions[sID]
			# Check if that player is indeed on its turn
			if playerN == cSession.gameState.currentPlayer:
				# Try to update the game state model
				if cSession.gameState.addBluffAndMove(bluff, move):
					return self.createResponse("success", "\"success\"")
				else:
					return self.createResponse("fail", "\"Problem updating model\"")
			else:
				return self.createResponse("fail", "\"Not this player turn\"")
		else:
			return self.createResponse("fail", "\"Incorrect Session ID\"")

	# Adds a prediction for the oposing player
	# Message: {sID, playerN, prediction_x, prediction_y}
	def addPredictionToSession(self, data):
		splitData = data.split(',')
		sID = int(splitData[0])
		playerN = int(splitData[1])
		pX = int(splitData[2])
		pY = int(splitData[3])
		prediction = (pX, pY)
		# Check Session ID in sessions
		if sID in self.sessions:
			cSession = self.sessions[sID]
			# Check if the current player is the correct one
			# Player that predicts is NOT the current player (current player only moves/bluffs)
			if playerN != cSession.gameState.currentPlayer:
				# Try to update
				if cSession.gameState.addPrediction(prediction):
					return self.createResponse("success", "\"success\"")
				else:
					return self.createResponse("fail", "\"Problem updating mode\"l")
			else:
				return self.createResponse("fail", "\"Not this player's turn to predict\"")
		else:
			return self.createResponse("fail", "\"Incorrect Session ID\"")


		
	# Maps socket commands to functions
	commandMap = {
		'login' : login,
		'create_session' : createSession,
		'join_session': joinSession,
		'session_upd': updateSession,
		'bluffmove': addBluffAndMoveToSession,
		'prediction': addPredictionToSession,
	}

	# Parse incoming request
	def parseRequest(self, request):
		# Clean curly brackets
		cleanReq = request[1:-1]
		# Split command from data
		req = cleanReq.split(':')
		return req
	
	# Responds to a message sent by a client
	# and updates server information
	def process(self, msg):
		req = self.parseRequest(msg)
		cmd = req[0]
		data = req[1]

		response = self.commandMap[cmd](self, data)
		return response

	def __init__(self):
		self.sessionIDs = []
		self.currentSID = 0
		self.sessions = {}
	



# Initialize the game server
server = GameServer()

@asyncio.coroutine
def routeMessages(websocket, path):
	# Receive a message
	message = yield from websocket.recv()
	print("Received message: " + message)

	# Process the message
	response = server.process(message)
	yield from websocket.send(response)

start_server = websockets.serve(routeMessages, '0.0.0.0', 5858)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
