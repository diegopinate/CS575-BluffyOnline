// ShooterApp module
var shooterApp = angular.module('shooterApp', ['ngRoute', 'ngResource']);

shooterApp.config(function($routeProvider) {
    $routeProvider

        .when('/', {
                templateUrl : 'pages/home.html',
                controller: 'mainController'
            })

        .when('/profile', {
                templateUrl: 'pages/profile.html',
                controller: 'mainController'
            })

        .when('/game', {
                templateUrl: 'pages/game.html',
                controller: 'mainController'
            })

        .when('/inbox', {
                templateUrl: 'pages/inbox.html',
                controller: 'messageController'
            })

        .when('/community', {
                templateUrl: 'pages/community.html',
                controller: 'communityController'
            })
        });

/*
shooterApp.config(['$resourceProvider', function($resourceProvider) {
    $resourceProvider.defaults.stripTrailingSlashes = false;
}])
*/

// create the controller and inject Angular's $scope
shooterApp.controller('mainController', function($scope, $http, $window, $location) {
    // Current logged user name
    $scope.user = 'none';
    // User's prestige
    $scope.prestige = '0';
    // User's friend list
    $scope.friends = [];
    // Keeps the message inbox
    $scope.inbox = [];
    // Keeps track of the user if he/she's logged or not
    $scope.userLogged = false;
    // This contains the index of the message that is opened to read in the inbox
    $scope.openedMessage = -1;
    // Used to show the Sign Up span division of the Home site
    $scope.onSignUp = false;
    // Sign up form data models
    $scope.signup = {'username':"", 'pwd':"", 'cpwd':""};
    // Used to add friends
    $scope.friendTextbox = "";
    // Status Label - Shows if a friend was added or not
    $scope.statusLabelProfile = "";

    // Show the sign up part of home or login part
    $scope.showSignUp = function(flag)
    {
        $scope.onSignUp = flag;
        $scope.$apply();
    };

    // Returns the host address
    $scope.getHost = function()
    {
        return $location.host();
    };

    // Loads the profile from the server
    $scope.loadProfile = function()
    {
        console.log("Loading profile.");
        jQuery.getJSON('http://' + $scope.getHost() + ':8989/profile', {}, function(res)
        {
            var data = JSON.parse(res);

            if (data.errorCode)
            {
                // Redirect to login screen if found an error
                console.log("Error: " + data.message);
                $window.location.href = '/';
                $scope.userLogged = false;
                $scope.$apply();
            }
            else {
                console.log("Got profile data.");
                $scope.user = data.user;
                $scope.prestige = data.prestige;
                $scope.friends = data.friends;
                $scope.userLogged = true;
                $scope.$apply();
            }
        });
    };

    // Add a friend
    $scope.addFriend = function(friendName)
    {
        if (friendName == "")
            return;

        friend = { 'fUsername': friendName };
        if (friend != "") {
            $http.post('/addfriend', friend).success(function (data, status) {
                $scope.loadProfile();
            }).error(function (data, status) {
                $scope.friendTextbox = "";
                $scope.statusLabelProfile = "Error: That person is not a user of the site.";
                $scope.$apply();
            });
        }
    };

    // Adds prestige to the user when a game is won
    $scope.addPrestige = function(prestige)
    {
        data = {'prestige': prestige};

        $http.post('addprestige', data).success(function(data, status){
            console.log("Added prestige!");
            $scope.loadProfile();
        }).error(function(data,status){
            console.log("Couldn't add prestige")
        });
    };

    // Loads the message inbox from the server
    $scope.loadInbox = function()
    {
        console.log("Loading inbox.");
        jQuery.getJSON('http://' + $scope.getHost() + ':8989/inbox', {}, function(res){
            var data = JSON.parse(res);

            if (data.errorCode)
            {
                // Route to login screen if not logged
                console.log("Error: " + data.message);
                $window.location.href = '/';
                $scope.userLogged = false;
                $scope.$apply();
            }
            else
            {
                console.log("Got inbox!");
                $scope.inbox = data;
                $scope.userLogged = true;
                $scope.$apply();
            }
        });
    };

    $scope.getMessage = function()
    {
        if ($scope.openedMessage == -1)
        {
            var response = {
                sender: '',
                receiver: '',
                date: '',
                time: '',
                message: '',
                subject: ''
            };

            return response;
        }

        return $scope.inbox[$scope.openedMessage];
    };

    // Sign up to the website
    $scope.signUp = function()
    {
        if ($scope.signup.username == "")
            return;
        if ($scope.signup.pwd == "")
            return;
        if ($scope.signup.cpwd == "")
            return;
        if ($scope.signup.pwd != $scope.signup.cpwd) {
            alert("Passwords do not match.");
            return;
        }

        var data = {'username':$scope.signup.username, 'password':$scope.signup.pwd};

        $http.post("/signUp", data).success(function(data, status){
            alert("You have signed up successfully. Log in now.");
            $scope.showSignUp(false);
        });
    };

    // Loads the selected message in the inbox partial
    $scope.loadMessage = function(msgIndex)
    {
        $scope.openedMessage = msgIndex;
        //$scope.$apply();
    };

    // Clears the message
    $scope.clearOpenedMessage = function()
    {
        $scope.openedMessage = -1;
        $scope.$apply();
    };

    $scope.logout = function()
    {
        $http.get("/logout").success(function(data, status, headers, config){
            $window.location.href = '/';
            $scope.userLogged = false;
        }).error(function(data, status, headers, config){
            console.log("Error logging out.");
        });
    };

    $scope.deleteMessage = function()
    {
        if ($scope.openedMessage != -1)
        {
            // Send message here to delete it
            $http.post("/delete_msg", $scope.inbox[$scope.openedMessage]).success(function(data, status){
                $scope.openedMessage = -1;
                $scope.loadInbox();
            });
        }
    };
});


shooterApp.controller('gameController', function($scope) {
    $scope.message = 'Game Controller!';
    $scope.canvasOn = false;
});

shooterApp.controller('messageController', function($scope) {
});

shooterApp.controller('communityController', function($scope, $resource, $location) {
    $scope.users = [];
    $scope.gotUsers = false;
    $scope.error = "";

    $scope.getUsers = function() {
        console.log("Getting users to populate...");
        jQuery.getJSON('http://' + $location.host() + ':8989/community/users', {}, function (res)
        {
            $scope.users = JSON.parse(res);
            $scope.gotUsers = true;
            console.log("Parsed users:" + $scope.users);
            $scope.$apply();
            return $scope.users;
        });
    }
});
