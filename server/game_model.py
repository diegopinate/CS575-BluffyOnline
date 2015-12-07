# This file contains the interface to represent the
# game state. This is used by the server program to
# maintain game sessions
from enum import Enum

# Bluffing Block State
# This class represents the game state
#
# Game Rules:
# This game is a turn based game in which each player has
# one board in which they move their "character"
# Before moving, player 1 has to send a "bluff" to the player 2
# telling him in which place he is going OR NOT going to
# After that, player 1 selects which
# position his "character" is going to go next
# After doing so, player 2 needs to guess where player 1
# is going to move. If he is correct, the tile where player 1 was
# will now become BLOCKED, and player 1 cannot go to that tile anymore
# Then, it is player 2's turn, doing the same thing on his own board
# The game ends when one of the players has become trapped
#
# Note: Players can move any direction but only one space at a time
class GameState:
	# Represents the current game state
	class State(Enum):
		# Player one's turn
		BluffMove 	= 1	# Player 1 selects bluff square and his move
		Predict		= 2 # Player 2 predicts where player 1 is going and
						#  apply the move - If player 2 prediction is correct
						#  block the position player 1 was at before

	# Array legend:
	# 0 - Empty block (Player can move to surrounding 0s
	# 1 - Position of the player in their respective boards
	# 2 - Block has been blocked by a correct guess of the other player
	# 3 - Represents a bluff, this gets cleared after the turn is over
	p1board = []
	p2board = []
	# Prediction tuples
	# These represent the prediction a player makes
	p1prediction = ()
	p2prediction = ()
	# Bluff tuples
	# These represent the bluff a player makes
	p1bluff = ()
	p2bluff = ()
	# Move position intended by a player
	p1move = ()
	p2move = ()

	# Current game state
	state = State.BluffMove
	# Current player
	currentPlayer = 1


	# Initialize game state
	def __init__(self):
		self.p2board = [[0,1,0],
			   	[0,0,0]]

		self.p1board = [[0,0,0],
				[0,1,0]]

	# Returns a player board
	def getPlayerBoard(self, player_n):
		if player_n == 1:
			return self.p1board
		if player_n == 2:
			return self.p2board
		return []

	# Add a bluff and move to the
	# Returns True if successful
	def addBluffAndMove(self, bluff, move):
		if self.state != self.State.BluffMove:
			print ("Error: The current state is not BLUFF.")
			print ("Current state: " + str(self.state))
			return False
		# Add logic for each player
		if self.currentPlayer == 1:
			self.p1move = move
			self.p1bluff = bluff
			print("Got bluff: " + str(bluff))
			self.p1board[bluff[1]][bluff[0]] = 3
			self.state = self.State.Predict
			return True
		if self.currentPlayer == 2:
			self.p2move = move
			self.p2bluff = bluff
			print ("Setting p2 move and bluff: " + str(self.p2move) + "," + str(self.p2bluff));
			self.p2board[bluff[1]][bluff[0]] = 3
			self.state = self.State.Predict
			return True
		# Incorrect current player number
		return False

	# Cycle the turn to the next player
	def cyclePlayers(self):
		if self.currentPlayer == 1:
			self.currentPlayer = 2
		else: 
			self.currentPlayer = 1
		print("Players cycled: Current player: " + str(self.currentPlayer))

	# Sets the prediction of the oposing player
	# if the prediction is correct, update board accordingly
	# if not, only move the player who chose a move
	# Returns true if successful
	def addPrediction(self, prediction):
		if self.state != self.State.Predict:
			print ("Error: The current state is not PREDICT.")
			print("Current state: " + str(self.state))
			return False
		# Clear the bluffs!
		self.clearBluffs();
		# Logic for each player
		if self.currentPlayer == 1:
			# New player position
			pNewX = self.p1move[0]
			pNewY = self.p1move[1]
			# Old player position
			pOldX, pOldY = self.getPlayerPosition(self.p1board)
			# Return false if the bluff is where the player is at
			if self.p1bluff == (pOldX, pOldY):
				return False
			# Player 2 is predicting Player 1's move
			if prediction == self.p1move:
				# Correct prediction, block the square the player is currently at
				self.p1board[pOldY][pOldX] = 2
			else:
				# Incorrect prediction, just clear the block
				self.p1board[pOldY][pOldX] = 0
			# Update player position
			self.p1board[pNewY][pNewX] = 1
			# Update player turn and state
			self.cyclePlayers()
			self.state = self.State.BluffMove
			return True
		if self.currentPlayer == 2:
			# New player position
			pNewX = self.p2move[0]
			pNewY = self.p2move[1]
			# Old player position
			pOldX, pOldY = self.getPlayerPosition(self.p2board)
			# Return false if the bluff is where the player is at
			if self.p2bluff == (pOldX, pOldY):
				return False
			# Player 2 is predicting Player 1's move
			if prediction == self.p2move:
				# Correct prediction, block the square the player is currently at
				self.p2board[pOldY][pOldX] = 2
			else:
				# Incorrect prediction, just clear the block
				self.p2board[pOldY][pOldX] = 0
			# Update player position
			self.p2board[pNewY][pNewX] = 1
			# Update player turn and state
			self.cyclePlayers()
			self.state = self.State.BluffMove
			return True
		return False

	# Clears a bluff (3) from the board
	def clearBluffFromBoard(self, board):
		for y in range(0, 1):
			for x in range(0,2):
				if board[y][x] == 3:
					board[y][x] = 0

	# Clears all bluffs found in the boards
	def clearBluffs(self):
		self.clearBluffFromBoard(self.p1board)
		self.clearBluffFromBoard(self.p2board)

	# Gets the player position on the board
	def getPlayerPosition(self, board):
		# Get player's position
		for x in range(0, 3):
			for y in range (0, 2):
				if board[y][x] == 1:
					return x,y
		# If this happens the board is invalid
		return -1,-1

	# Returns true if a position is a potential move
	def checkPossiblePosition(self, board, x, y):
		if x < 0 or x > 2:
			return False
		if y < 0 or y > 1:
			return False
		if board[y][x] == 1:
			return False
		if board[y][x] == 2:
			return False

		return True
		
	# Gets a board possible moves of a board
	def getPossibleMovesOfBoard(self, board):
		moves = []
		pX, pY = self.getPlayerPosition(board)

		# Check all positions in the range of the player's movement
		for dx in range(-1, 2):
			for dy in range(-1, 2):
				if self.checkPossiblePosition(board, pX+dx, pY+dy):
					moves.append((pX+dx, pY+dy))

		return moves

	# Gets the possible moves for the current player
	def getPossibleMoves(self):
		if self.currentPlayer == 1:
			return self.getPossibleMovesOfBoard(self.p1board)
		else:
			return self.getPossibleMovesOfBoard(self.p2board)

	# Applies a move to the board state
	# the move must be a POSSIBLE MOVE
	def applyMove(self, board, x, y):
		pX, pY = self.getPlayerPosition(board);
		board[pY][pX] = 0
		board[y][x] = 1

	# Returns true if the board's player
	# can no longer move
	def checkBoardLost(self, board):
		moves = self.getPossibleMovesOfBoard(board)

		if len(moves) == 0:
			return True

		return False

		# Check surroundings of player to see if it's blocked

	# Returns 1 if player 1 won
	# Returns 2 if player 2 won
	# Returns 0 if neither
	def checkWin(self):
		if self.checkBoardLost(self.p1board):
			return 2
		if self.checkBoardLost(self.p2board):
			return 1
		return 0
