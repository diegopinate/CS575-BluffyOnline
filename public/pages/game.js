/// Javascript Game Client

// Represents the different states of the JS Game
var GameState =
{
    Menu: 1,
    JoinSession: 2,
    CreateSession: 3,
    OnSession: 4
};

var GamePhase =
{
    BluffMove: 1,
    Predict: 2
};

var updateInterval = null;

// Used for the board buttons
// x and y positions
// size of the button
// board_x and board_y represent which part of the array they represent
// The array value
var BoardButton = function(_x, _y, _size, _bX, _bY, _val, _hi)
{
    this.x = _x;
    this.y = _y;
    this.size = _size;
    this.board_x = _bX;
    this.board_y = _bY;
    this.value = _val;
    this.highlight = _hi;
};

var p1boardButtons = [[]];
var p2boardButtons = [[]];

// WebSockets are used to connect to the python server
var serverPort = "5858";

var statusMessage = "Waiting for player to join.";
var currentState = GameState.Menu;

// Maintain data about the current session
var currentSession = {
    // Local information needed
    "currentPlayer": -1,
    "currentMove": {"x": -1, "y": -1},
    "currentBluff": {"x": -1, "y": -1},
    "currentPrediction": {"x": -1, "y": -1},
    "gotMove": false,
    "gameFinished": false,
    // Online state data
    "SessionID": -1,
    "Player1": "",
    "Player2": "",
    "p1board": [[0,0,0],[0,1,0]],
    "p2board": [[0,1,0],[0,0,0]],
    // Player 1:1 - Player 2:2
    "turn": 1,
    "phase": GamePhase.BluffMove,
    "win": 0
};

// Open a socket to the python server to send a message and receive
function createSocket()
{
    var serverAddress = getNgScope().getHost();
    return new WebSocket('ws://' + serverAddress + ":" + serverPort)
}

// Creates a response to send to the server
function createRequest(cmd, data)
{
    var request = "{" + cmd + ":" + data + "}";
    return request;
}

var canvas = null;
var ctx = null;
var mouseX, mouseY;

function drawBall(x,y,r)
{
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
}

function updateMouse(evt){
    var rect = canvas.getBoundingClientRect();
    mouseX = evt.clientX - rect.left;
    mouseY = evt.clientY - rect.top;
}

// Returns true if the mouse is over a specific box area
function mouseOverBox(x,y,width,height){
    if (mouseX >= x && mouseX <= x + width){
        if (mouseY >= y && mouseY <= y + height){
            return true;
        }
    }

    return false;
}

// Mouse down event handler
function mouseDown(evt){

}

// Gets the angular scope of the mainController
function getNgScope(){
    return angular.element(document.getElementById('gameCanvas')).scope();
}

// Resets the state and go to menu
function resetState(){
    currentState = GameState.Menu;
    currentSession.SessionID = -1;
    currentSession.Player1 = "No player";
    currentSession.Player2 = "No player";
    currentSession.win = 0;
}

// This is called when the player won the game
// This will make the angular application update the prestige of the user
// Adding 10 to it per won game
function wonGame()
{
    getNgScope().addPrestige(10);
}

// Asks the server for update data
function updateState()
{
    console.log("Requesting update...");
    var req = createRequest("session_upd","" + currentSession.SessionID);
    var socket = createSocket();
    // When the socket is opened, send the request
    socket.onopen = function() {
        socket.send(req);
    };
    // Update state with the message
    socket.onmessage = function(msg){
        // Parse message with Session ID
        var pMsg = JSON.parse(msg.data);
        var resCmd = pMsg.resp.cmd;
        var resData = pMsg.resp.data;
        if (resCmd == "update")
        {
            // Got correct response
            currentSession.Player1  = resData.player1;
            currentSession.Player2  = resData.player2;
            currentSession.p1board  = resData.p1board;
            currentSession.p2board  = resData.p2board;
            currentSession.turn     = resData.turn;
            currentSession.phase    = resData.phase;
            currentSession.win      = resData.win;

            // Update if somebody won
            if (currentSession.win != 0 && currentSession.gameFinished == false)
            {
                currentSession.gameFinished = true;

                if (currentSession.currentPlayer == currentSession.win)
                {
                    console.log("PLAYER WON THE GAME!");
                    wonGame();
                }

                // Stop updating!
                ctx.clearInterval(updateInterval);
                updateInterval = null;
            }
        }
        else
        {
            alert("Error updating.");
            resetState();
        }
    };
}

// Creates a session and changes state
function createSession(){
    currentState = GameState.CreateSession;
    // Request to server to create a new session
    var scope = getNgScope();
    var req = createRequest("create_session",scope.user);
    var socket = createSocket();
    // When the socket is opened, send the request
    socket.onopen = function() {
        socket.send(req);
    };
    // Update state with the message
    socket.onmessage = function(msg){
        // Parse message with Session ID
        pMsg = JSON.parse(msg.data);
        var resCmd = pMsg.resp.cmd;
        var resData = pMsg.resp.data;
        if (resCmd == "sID")
        {
            // Got correct response
            currentState = GameState.OnSession;
            currentSession.SessionID = resData;
            currentSession.Player1 = scope.user;
            currentSession.currentPlayer = 1;
            updateInterval = setInterval(updateState,1000);
        }
        else
        {
            alert("Error creating session.");
            resetState();
        }
    };
}

// Go to the join session
function joinSession(){
    currentState = GameState.JoinSession;
    // For now, just join a random session
    var scope = getNgScope();
    var req = createRequest("join_session",scope.user + ",-1");
    var socket = createSocket();
    // When the socket is opened, send the request
    socket.onopen = function() {
        socket.send(req);
    };
    // Update state with the message
    socket.onmessage = function(msg){
        // Parse message with Session ID
        pMsg = JSON.parse(msg.data);
        var resCmd = pMsg.resp.cmd;
        var resData = pMsg.resp.data;
        if (resCmd == "joined")
        {
            // Got correct response
            currentState = GameState.OnSession;
            currentSession.SessionID = Number(resData.split(',')[1]);
            currentSession.Player1 = resData.split(',')[0];
            currentSession.Player2 = scope.user;
            currentSession.currentPlayer = 2;
            setInterval(updateState,1000);
        }
        else
        {
            alert("No sessions available! Create one!");
            resetState();
        }
    };
}

// Sends a bluff and a move to the server
function sendBluffAndMove(bluff, move)
{
    var req = createRequest("bluffmove",currentSession.SessionID + "," + currentSession.currentPlayer + ","
                            + move.x + "," + move.y + "," + bluff.x + "," + bluff.y);
    var socket = createSocket();
    // When the socket is opened, send the request
    socket.onopen = function() {
        socket.send(req);
    };
    // Update state with the message
    socket.onmessage = function(msg){
        var pMsg = JSON.parse(msg.data);
        var resCmd = pMsg.resp.cmd;
        var resData = pMsg.resp.data;
        if (resCmd == "fail")
        {
        }
    };
}

// Sends a prediction to the server
function sendPrediction(prediction)
{
    var req = createRequest("prediction",currentSession.SessionID + "," + currentSession.currentPlayer + ","
                            + prediction.x + "," + prediction.y);
    var socket = createSocket();
    // When the socket is opened, send the request
    socket.onopen = function() {
        socket.send(req);
    };
    // Update state with the message
    socket.onmessage = function(msg){
        var pMsg = JSON.parse(msg.data);
        var resCmd = pMsg.resp.cmd;
        var resData = pMsg.resp.data;
        if (resCmd == "fail")
        {
        }
    };
}


// Draw a button in the game
function drawButton(text,x,y,width,height,highlight)
{
    // Highlight button
    if (highlight) {
        if (mouseOverBox(x, y, width, height)) {
            ctx.fillStyle = "rgb(100,150,200)";
            ctx.fillRect(x, y, width, height);
            ctx.stroke();
        }
    }
    ctx.fillStyle = "black";
    ctx.rect(x, y, width, height);
    ctx.stroke();

    // Draw text if not empty
    if (text != "") {
        ctx.fillStyle = "black";
        ctx.font = "20px Century Gothic";
        var fx = x + width / 2 - (text.length) * 20 / 4;
        var fy = y + height / 2 + 10;
        ctx.fillText(text, fx, fy);
    }
}

// Draw text Center Aligned
function drawText(text, x, y, size)
{
    var fx = x - size/4*text.length;
    var fy = y - size/4;
    ctx.fillText(text, fx, fy);
}

// Draw text Left Aligned
function drawTextLA(text, x, y)
{
    ctx.fillText(text, x, y);
}

// Updates the status message
function updateStatusMessage()
{
    if (currentSession.Player1 == "" || currentSession.Player2 == "")
        return "Waiting for player to join.";

    if (currentSession.gameFinished)
    {
        return "PLAYER " + currentSession.win + " WON!";
    }

    if (currentSession.turn == currentSession.currentPlayer){
        if (currentSession.phase == GamePhase.BluffMove)
        {
            if (currentSession.gotMove)
                return "Select your bluff!";
            else
                return "Select your move!";
        }
        else{
            return "Wait for player to predict your move.";
        }

    }
    else{
        if (currentSession.phase == GamePhase.BluffMove){
            return "Wait for player to make a move and bluff.";
        }
        else {
            return "Select your prediction on the other board.";
        }
    }
}

// Draws a board
function drawBoard(board, origin_x,origin_y,block_size)
{
    for (i = 0; i < 3; i++)
    {
        for (j = 0; j < 2; j++)
        {
            var x = origin_x + (i*(block_size+3));
            var y = origin_y + (j*(block_size+3));
            if (board[j][i] != 2)
                drawButton("", x, y, block_size, block_size, false);
            if (board[j][i] == 1)
                drawBall(x+block_size/2,y+block_size/2,block_size/2-10);
            if (board[j][i] == 3)
                drawText("BLUFF!",x+block_size/2,y+block_size/2, 14);
        }
    }
}

// Draws a board from the button objects
function drawButtonBoard(buttonBoard)
{
    for (i = 0; i < 3; i++)
    {
        for (j = 0; j < 2; j++)
        {
            var button = buttonBoard[j][i];
            if (button.value != 2)
                drawButton("", button.x, button.y, button.size, button.size, button.highlight);
            if (button.value == 1)
                drawBall(button.x + button.size/2, button.y + button.size/2, button.size/2-10);
            if (button.value == 3)
                drawText("BLUFF!",button.x+button.size/2,button.y+button.size/2, 14);
        }
    }
}

// Creates the "board" which is an array of boardbutton
function createBoard(board, orig_x, orig_y, size, highlight){
    container = [[],[]];
    for (x=0; x<3; x++)
    {
        for (y=0; y<2; y++)
        {
            cX = orig_x + x*(size+3);
            cY = orig_y + y*(size+3);
            currentButton = new BoardButton(cX, cY, size, x, y, board[y][x], highlight);
            container[y].push(currentButton);
        }
    }

    return container;
}

// Creates the board buttons depending on the board data
function createBoards()
{
    board_x = canvas.width/2 - 158/2;
    // TO-DO: Make them highlight depending on game state
    //p1hi = (currentSession.currentPlayer == currentSession.turn) || (currentSession);
    p1boardButtons = createBoard(currentSession.p1board, board_x, 100, 50, true);
    p2boardButtons = createBoard(currentSession.p2board, board_x, 300, 50, true);
}

// Manages the game session
function gameSessionLoop()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    // Draw boards
    createBoards();
    drawButtonBoard(p1boardButtons);
    drawButtonBoard(p2boardButtons);
    // Draw interface
    ctx.fillStyle = "black";
    ctx.font = "20px Century Gothic";
    drawText("Session ID: " + currentSession.SessionID, canvas.width/2, 40, 20);
    ctx.font = "14px Century Gothic";
    drawTextLA("Player 1:\n" + currentSession.Player1, 10, 80);
    drawTextLA("Player 2:\n" + currentSession.Player2, 10, 400);
    statusMessage = updateStatusMessage();
    drawTextLA(statusMessage, 10, 260);

    if (currentSession.gameFinished)
    {
        drawButton("Go back to main menu", canvas.width/2-150, canvas.height/2 + 180, 300, 50, true);
    }
}

// Returns the button that is underneath the mouse
function getButtonBelowMouse(buttonBoard)
{
    for (i=0; i<3; i++)
    {
        for (j=0; j<2; j++)
        {
            var button = buttonBoard[j][i];
            if (mouseOverBox(button.x, button.y, button.size, button.size))
                return button;
        }
    }

    return null;
}

// Gets the player board depending on which player he is (2 or 1)
function getPlayerBoard()
{
    if (currentSession.currentPlayer == 1)
        return p1boardButtons;
    else
        return p2boardButtons
}

// Get the oposing player's board buttons
function getOtherPlayerBoard()
{
    if (currentSession.currentPlayer == 1)
        return p2boardButtons;
    else
        return p1boardButtons;
}

// Handles when the user's mouse is on a up event (after clicking)
// Uses this information to update game state and affect buttons/controls
function handleGameClicks()
{
    if (currentSession.gameFinished)
    {
        if (mouseOverBox(canvas.width/2-150, canvas.height/2 + 180, 300, 50))
        {
            // Go back to menu
            currentState = GameState.Menu;
            // Reset state
            resetState();
        }

        // Don't process any other clicks if we already finished the game!
        return;
    }
    // The player needs to select the bluff and the move!
    if (currentSession.turn == currentSession.currentPlayer &&
        currentSession.phase == GamePhase.BluffMove)
    {
        button = getButtonBelowMouse(getPlayerBoard());
        if (button != null)
        {
            if (currentSession.gotMove)
            {
                currentSession.currentBluff.x = button.board_x;
                currentSession.currentBluff.y = button.board_y;
                currentSession.gotMove = false;
                // Send the bluff and the move
                sendBluffAndMove(currentSession.currentBluff, currentSession.currentMove);

            }
            else
            {
                currentSession.currentMove.x = button.board_x;
                currentSession.currentMove.y = button.board_y;
                currentSession.gotMove = true;
            }
        }
    }
    // The player needs to select the prediction
    if (currentSession.turn != currentSession.currentPlayer &&
        currentSession.phase == GamePhase.Predict)
    {
        button = getButtonBelowMouse(getOtherPlayerBoard());
        if (button != null)
        {
            currentSession.currentPrediction.x = button.board_x;
            currentSession.currentPrediction.y = button.board_y;
            // Send the prediction to the server
            sendPrediction(currentSession.currentPrediction);
        }
    }
}

// Mouse up event handler
function mouseUp(evt){
    switch (currentState) {
        case GameState.Menu:
            // Clicked create session button
            if (mouseOverBox(10,150,canvas.width-20,100))
                createSession();
            // Clicked the join session button
            if (mouseOverBox(10,270, canvas.width-20, 100))
                joinSession();
            break;
        case GameState.CreateSession:
            break;
        case GameState.JoinSession:
            break;
        case GameState.OnSession:
            handleGameClicks();
            break;
    }
}

// Manages the main loop of the JS "Application"
function mainLoop()
{
    var scope = getNgScope();
    if (scope == null)
    {
        canvas = null;
    }
    if (canvas == null) {
        if (document.getElementById("gameCanvas") != null) {
            setCanvas(document.getElementById("gameCanvas"));
        }
    }
    else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        switch (currentState) {
            case GameState.Menu:
                ctx.fillStyle = "black";
                ctx.font = "20px Century Gothic";
                drawText("Bluffy Online", canvas.width/2, 40, 20);
                drawButton("Create Session", 10, 150, canvas.width-20, 100, true);
                drawButton("Join Session", 10, 270, canvas.width-20, 100, true);
                break;
            case GameState.CreateSession:
                break;
            case GameState.JoinSession:
                break;
            case GameState.OnSession:
                gameSessionLoop();
                break;
        }
    }
}

function stopGame() {
    // Reset the canvas so that it can be reloaded
    canvas = null;
    // TO-DO: Stop other important game functions like networking
}

function setCanvas(c)
{
    canvas = c;
    ctx = canvas.getContext("2d");
    canvas.addEventListener("mousemove", updateMouse, false);
    canvas.addEventListener("mousedown", mouseDown, false);
    canvas.addEventListener("mouseup", mouseUp, false);
    createBoards();
}

setInterval(mainLoop,10);
