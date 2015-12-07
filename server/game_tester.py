# This provides an interactive program for the game_model
from game_model import GameState

def printBoard(board):
	row = ''
	for y in range(len(board)):
		for x in range(len(board[0])):
			row += str(board[y][x]) + ", "
		print(row)
		row = ''

def printState(gs):
	print("Player 2 Board")
	printBoard(gs.getPlayerBoard(2))
	print("Player 1 Board")
	printBoard(gs.getPlayerBoard(1))

gs = GameState()

# Parses a tuple
def parseTuple(string):
	values = string.split(',')
	tup = (int(values[0]), int(values[1]))
	print ("Parsed tuple: " + str(tup))
	return tup

# Main game loop
while gs.checkWin() == False:
	printState(gs)
	print("Player " + str(gs.currentPlayer) + "'s turn:")
	print("Possible moves: " + str(gs.getPossibleMoves()))
	bluff = parseTuple(input("Insert bluff: "))
	move = parseTuple(input("Insert move: "))
	gs.addBluffAndMove(bluff, move)
	print("Player " + str(gs.currentPlayer) + "'s Bluff!")
	printState(gs)
	prediction = parseTuple(input("Other Player prediction: "))
	gs.addPrediction(prediction)
	print("After prediction:")
	gs.clearBluffs()
	printState(gs)
