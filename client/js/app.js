var app = angular
  .module("wedding", ['ui.router', 'ngRoute']);
    
app .config([
  '$stateProvider',
  '$urlRouterProvider', 
  function($stateProvider, $urlRouterProvider){
    $stateProvider
    
        .state('slideshow', {
          url: '/slideshow',
          templateUrl: '/slideshow.html',
          onEnter: ['$state', 'auth', function($state, auth){
            if(auth.isLoggedIn()){
              $state.go('home');
            }
        }]
          
        })
        
        .state('guestbook', {
          url: '/guestbook',
          templateUrl: '/guestbook.html',
          controller: 'guestbookCtrl',
          resolve: {
            postPromise: ['guest', function(guest){
              return guest.fetchAll();
            }]
          }
        })
        
        .state('playlist', {
          url: '/playlist',
          templateUrl: '/playlist.html',
          controller: 'playlistCtrl',
          resolve: {
            postPromise: ['playlist', function(playlist){
              return playlist.fetchAll();
            }]
          }
        })
        
        .state('login', {
            url: '/login',
            templateUrl: '/login.html',
            controller: 'AuthCtrl',
            onEnter: ['$state', 'auth', function($state, auth){
                if(auth.isLoggedIn()){
                $state.go('home');
            }
        }]
      })
      
      .state('home', {
          url: '/home',
          templateUrl: '/home.html',
          controller: 'playlistCtrl',
          resolve: {
            postPromise: ['playlist', function(playlist){
              return playlist.fetchAll();
            }]
          }
      });
      
    $urlRouterProvider.otherwise('slideshow');

   
    }
]);

app.factory('guest', ['$http', function($http) {
  var object = {
    posts: [],
    fetchAll: function() {
        return $http.get("/guest").success(function(data){
            angular.copy(data, object.posts);
        })
    },
    createPost : function(post) {
      return $http.post("/guest", post).success(function(data){
        object.posts.push(data);
      });
    }
  }
  return object;
}])

app.factory('playlist', ['$http', function($http) {
  var object = {
    songs: [],
    fetchAll: function() {
      return $http.get("/song").success(function(data) {
        angular.copy(data, object.songs);
      })
    },
    createPost: function(song) {
      return $http.post("/song", song).success(function(data) {
        object.songs.push(data);
      })
    },
    upvote : function(song){
      return $http.put('/songs/' + song._id +'/upvote', song).success(function(data) {
        song.upvotes+=1;
      });
     } 
  };
  return object;
}])

app.factory('auth', ['$http', '$window', function($http, $window){
      var auth = {
      
      saveToken : function (token){
        $window.localStorage['wedding-token'] = token;
      },

      getToken : function(token) {
        return $window.localStorage['wedding-token'];
      },

      isLoggedIn : function() {
        var token = auth.getToken();

        if(token) {
          var payload = JSON.parse($window.atob(token.split('.')[1]));
          return payload.exp > Date.now() / 1000;
        } else {
          return false;
        }
      },

      currentUser : function() {
        if(auth.isLoggedIn()) {
          var token = auth.getToken();
          var payload = JSON.parse($window.atob(token.split('.')[1]));

          return payload.username;
        }
      },

      logIn : function(user) {
        return $http.post('/login', user).success(function(data){
          auth.saveToken(data.token);
        });
      },

      logOut : function() {
        $window.localStorage.removeItem('wedding-token');
      }
  };

  return auth;
}])

app.controller('playlistCtrl', [
  '$scope',
  '$state',
  'playlist',
  function($scope, $state, playlist) {
    
    $scope.songs = playlist.songs;
    $scope.addPost = function() {
      playlist.createPost({name: $('#songname').val(), title: $('#songtitle').val(), upvotes: 0});
      $('#songtitle').val('');
    };
    $scope.increaseUpvotes = function(song) {
      playlist.upvote(song);
    }
    setTimeout(function(){
        $scope.$apply(function(){
            $scope.songs = playlist.songs;
        });
    }, 5000);
  }])
  
app.controller('guestbookCtrl', [
    '$scope',
    '$state',
    'guest',
    function($scope, $state, guest) {
      $scope.posts = guest.posts;
      $scope.addPost = function() {
        guest.createPost({name: $('#name').val(), post: $('#comment').val()});
        $('#comment').val('');
      }
}])

app.controller('AuthCtrl', [
'$scope',
'$state',
'auth',
function($scope, $state, auth){
  $scope.user = {};

  $scope.register = function(){
    auth.register($scope.user).error(function(error){
      $scope.error = error;
    }).then(function(){
      $state.go('home');
    });
  };

  $scope.logIn = function(){
    auth.logIn($scope.user).error(function(error){
      $scope.error = error;
    }).then(function(){
      $state.go('home');
    });
  };
}])

app.controller('NavCtrl', [
    '$scope',
    'auth',
    function($scope, auth){
        $scope.isLoggedIn = auth.isLoggedIn;
        $scope.currentUser = auth.currentUser;
        $scope.logOut = auth.logOut;
    }]);
    
function searchYoutube(){
    $("#player").empty();
    $("#player").append('<iframe id="ytplayer" type="text/html" width="640" height="390" src="https://www.youtube.com/embed?listType=search&autoplay=1&list=' + $("#searchtext").val() + '" frameborder="0"/>');
}

$(document).ready(function(){
    var socket = io.connect();
    var input = document.getElementById('myFileInput');
    var images = [];
    
    // $("#searchbutton").on('click', function() {
    //     console.log('hi');
    //     $("#player").empty();
    //     $("#player").append('<iframe id="ytplayer" type="text/html" width="640" height="390" src="https://www.youtube.com/embed?listType=search&autoplay=1&list=' + $("#searchtext").val() + '" frameborder="0"/>');
    // });
    
    // $("#myFileInput").on('change', function() {
    //     readFile(input.files[0]);
    //     //document.getElementById("text").innerHTML = document.getElementById("textinput").value;
    // });
    // function readFile(file){
    //     var reader = new FileReader();
    //     var image = new Image();
        
    //     reader.readAsDataURL(file);
    //     reader.onload = function(_file){
    //         image.src = _file.target.result;
    //         image.onload = function(){
    //             //var w = this.width, h = this.height, t = file.type, n = file.name, s = ~~(file.size/1024) + 'KB';
    //             //socket.emit('upload', {url:this.src});
    //             //console.log('emitted upload');
    //             $('#filename').innerHTML = file.name;
    //             console.log(image.src);
    //             reader = null;
    //             image = null;
    //         }
    //     }
    // }

    var picIndex = 0;
    function slidePics (){
        if(picIndex < images.length){
            $("#slideshow img").attr('src', './uploaded_images/' + images[picIndex]);
            picIndex++;
        } else{
            picIndex = 0;
        }
        setTimeout(slidePics, 3000);
    }
    slidePics();
    
    socket.on("initialPic", function(data){
       images = data;
    });
    socket.on('upload', function(data) {
        console.log("upload received in app");
        images.push(data);
        console.log(images);
        console.log("upload called");

    });
    
});

