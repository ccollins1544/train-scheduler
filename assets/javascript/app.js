/*********************************************************
 * Train Scheduler
 * @package Train Scheduler
 * @author Christopher Collins
 * @version 1.2.0
 * @license none (public domain)
 * 
 * ===============[ TABLE OF CONTENTS ]===================
 * 0. Globals
 *   0.1 scheduleTableFields
 * 
 * 1. Firebase
 *   0.1 Firebase Configuration
 *   0.2 Initialize Firebase
 *   0.3 Firebase Authentication
 *     0.3.1 Store CurrentUser as global
 *     0.3.2 Initialize the FirebaseUI Widget
 *     0.3.3 UI Configuration
 *     0.3.4 Persist Authentication
 * 
 * 2. Functions
 *   2.1 firebaseWatcher
 *   2.2 addTrainToSchedule
 *   2.3 addTrain
 *   2.4 deleteTrain
 *   2.5 editTrain
 *   2.6 trainMinutesAway
 *   2.7 updateTrainSchedule
 *   2.8 startClock
 *   2.9 CurrentUser
 *   2.10 SignOut
 * 
 * 3. Document Ready
 *   3.1 Watch Database + Initial Loader
 *   3.2 Add Train on Submit
 *   3.3 Update Train Schedule Every minute
 *   3.4 Check if User Logged In and update CurrentUser global
 *   3.5 Delete Train on click
 *   3.6 Edit Train on click
 * 
 *********************************************************/
/* ===============[ 0. GLOBALS ]=========================*/
// 0.1 scheduleTableFields 
var scheduleTableFields = ["train-name", "train-destination", "train-frequency", "next-arrival", "minutes-away"];

/**
 * 0.1 Firebase Configuration
 * https://firebase.google.com/docs/database/admin/retrieve-data
 */
var firebaseConfig = {
  apiKey: "AIzaSyAVj1DhT_LO-Nn_YcBVhpHRgGbn2JCth6E",
  authDomain: "ccollins-fall2019.firebaseapp.com",
  databaseURL: "https://ccollins-fall2019.firebaseio.com",
  projectId: "ccollins-fall2019",
  storageBucket: "",
  messagingSenderId: "541445299555",
  appId: "1:541445299555:web:d9ceca0430a78546108756"
};

// 0.2 Initialize Firebase
firebase.initializeApp(firebaseConfig);
var fdb = firebase.database();
var dbRef = fdb.ref("/trainScheduler");

/**
 * 0.3 Firebase Authentication
 */
// 0.3.1 Store CurrentUser as global
var CurrentUser;

// 0.3.2 Initialize the FirebaseUI Widget
var ui = new firebaseui.auth.AuthUI(firebase.auth());

/**
 * 0.3.3 UI Configuration
 * Sets up the signInOptions and default UI on our target DOM element #firebaseui-auth-container.
 * Callbacks handle what happens on login success and login failure.
 */
var uiConfig = {
  callbacks: {
    signInSuccessWithAuthResult: function (authResult, redirectUrl) {
      // User successfully signed in.
      // Return type determines whether we continue the redirect automatically
      // or whether we leave that to developer to handle.
      // return true;

      console.log("Auth Result", authResult);
      updateCurrentUser();
      $("#authModal-close").click();
      return false; // set to false because we are not redirecting to the signInSuccessUrl
    },

    // signInFailure callback must be provided to handle merge conflicts which
    // occur when an existing credential is linked to an anonymous user.
    signInFailure: function (error) {
      // For merge conflicts, the error.code will be
      // 'firebaseui/anonymous-upgrade-merge-conflict'.
      if (error.code != 'firebaseui/anonymous-upgrade-merge-conflict') {
        return Promise.resolve();
      }
      // The credential the user tried to sign in with.
      var cred = error.credential;
      // Copy data from anonymous user to permanent user and delete anonymous
      // user.
      // ...
      // Finish sign-in after data is copied.
      return firebase.auth().signInWithCredential(cred);
    },
    uiShown: function () {
      // The widget is rendered.
      // Hide the loader.
      document.getElementById('loader').style.display = 'none';
    }
  },


  // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
  signInFlow: 'popup',

  // Whether to upgrade anonymous users should be explicitly provided.
  // The user must already be signed in anonymously before FirebaseUI is
  // rendered.
  autoUpgradeAnonymousUsers: true,
  signInSuccessUrl: '/',
  signInOptions: [{
      provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
      requireDisplayName: false
    },
    {
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      scopes: [
        'https://www.googleapis.com/auth/contacts.readonly'
      ],
      customParameters: {
        // Forces account selection even when one account
        // is available.
        prompt: 'select_account'
      }
    },
    firebase.auth.GithubAuthProvider.PROVIDER_ID
  ],
  // Terms of service url.
  // tosUrl: '<your-tos-url>',
  // Privacy policy url.
  // privacyPolicyUrl: '<your-privacy-policy-url>'
}; // END uiConfig

// The start method will wait until the DOM is loaded.
ui.start('#firebaseui-auth-container', uiConfig);

/**
 * 0.3.4 Persist Authentication
 * https://firebase.google.com/docs/auth/web/auth-state-persistence
 * NOTE: The default is Persistance.LOCAL which means we don't need to worry about setting persistance
 * unless we want to persist when the current tab is open. The main issue I was having before was 
 * I needed to delay the function updateCurrentUser by 500milliseconds before page load in order 
 * to capture the CurrentUser.
 *************************************************************************************************
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION).then(function () {
  // Existing and future Auth states are now persisted in the current
  // session only. Closing the window would clear any existing state even
  // if a user forgets to sign out.
  // ...
  // New sign-in will be persisted with session persistence.
  return firebase.auth().signInWithEmailAndPassword(email, password);

}).catch(function (error) {
  // Handle Errors here.
  var errorCode = error.code;
  var errorMessage = error.message;
});
*/

/* ===============[ 2. Functions ]=======================*/
/**
 * 2.1 firebaseWatcher
 * Watches firebase database for either a 'value' or 'child_added' and fetches fields that match scheduleTableFields 
 * array and saves them to tableData. Then finally calls addTrainToSchedule(tableData) when event occurs.
 * 
 * @param {firebase.database().ref("/child")} databaseReference 
 * @param {string} onChange - can be 'value' or 'child_added'
 */
var firebaseWatcher = function (databaseReference, onChange = "child_added") {
  // set default database reference to our global dbRef
  databaseReference = (databaseReference === undefined) ? dbRef : databaseReference;

  // Firebase watcher + initial loader 
  databaseReference.on(onChange, function (snap) {

    var tableData = {};
    var firstTime = false;
    var uniqueKey = false;
    for (var property in snap.val()) {
      if (snap.val().hasOwnProperty(property)) {
        // console.log(property + " : " + snap.val()[property]);

        if (uniqueKey === false) {
          uniqueKey = snap.key;
        }

        if (scheduleTableFields.includes(property)) {
          tableData[property] = snap.val()[property];

        } else if (property === "train-start-time") {
          firstTime = snap.val()[property];
        }

      }
    }

    // Calculate 'next-arrival' time and 'minutes-away' 
    if (firstTime !== false && tableData.hasOwnProperty('train-frequency')) {
      var minutesAway = trainMinutesAway(firstTime, tableData["train-frequency"]);
      var nextTrain = moment().add(minutesAway, "minutes");

      tableData['next-arrival'] = moment(nextTrain).format("HH:mm A");
      tableData['minutes-away'] = minutesAway;
    }

    tableData['key'] = uniqueKey;
    addTrainToSchedule(tableData);

  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });

} // END firebaseWatcher

/**
 * 2.2 addTrainToSchedule
 * Adds a row to #train-schedule table body. 
 * @param {object} tableRowObj - properties in this object must be inside the global scheduleTableFields
 */
var addTrainToSchedule = function (tableRowObj) {
  var newRow = $("<tr>");

  for (var i in scheduleTableFields) {
    var KEY = scheduleTableFields[i];

    if (tableRowObj.hasOwnProperty(KEY)) {
      var VALUE = tableRowObj[KEY];
      newRow.append(
        $("<td>").text(VALUE)
      );
    }

  } // loop through scheduleTableFields

  if (CurrentUser !== undefined && CurrentUser !== null) {
    var editIcon = $("<i>").addClass("fas fa-pencil-alt edit");
    var deleteIcon = $("<i>").addClass("fas fa-trash-alt delete mr-4");
    var updateIcons = $("<span>").append(deleteIcon, editIcon);

    newRow.find(":last-child").addClass("d-flex justify-content-between").append(updateIcons);
  }

  if (tableRowObj.hasOwnProperty('key')) {
    newRow.attr("data-key", tableRowObj['key']);
  }

  $("#train-schedule > tbody").append(newRow);
} // END addTrainToSchedule

/**
 * 2.3 addTrain
 * Gets form data from #add-train-form adds it to the database.
 * @param {object} event 
 */
function addTrain(event) {
  event.preventDefault();

  if (CurrentUser === undefined || CurrentUser === null) {
    $('#authModal').modal(); // Restrict access to logged in users only. 
    return;
  }

  var formArray = $("#add-train-form").serializeArray();
  var formData = {}; // NOTE: {} creates and object and [] creates an Array.

  for (var i in formArray) {
    var KEY = "";
    var VALUE = "";

    for (var key in formArray[i]) {
      // console.log(key+" => "+formArray[i][key]);

      if (key == "name") {
        KEY = formArray[i][key];

      } else if (key == "value") {
        VALUE = formArray[i][key];
      }

    }
    formData[KEY] = VALUE.trim();
    if (formData[KEY] === "") {
      return; // prevent empty entries into database
    }
  }

  formData.dateAdded = firebase.database.ServerValue.TIMESTAMP;

  if ($("#add-train-form").data("action") === "update" && $("#add-train-form").data("key") !== "0") {
    // Update
    var uniqueKey = $("#add-train-form").data("key");
    var childRef = dbRef.child(uniqueKey);
    childRef.update(formData);

    // Reset back to 'Add' action
    $("#add-train-form").data("action", "add");
    $("#add-train-form").data("key", "0");
    var plusIcon = $("<i>").addClass("fas fa-plus");
    $("#add-train").html("Submit ").append(plusIcon);

    updateTrainSchedule();
  } else {
    // Add
    dbRef.push(formData);
  }

  // Clear Form Values
  $("#add-train-form *").filter(":input").each(function () {
    $(this).val("");
  });

} // END addTrain


/**
 * 2.4 deleteTrain
 * Gets uniqueKey from table-row and deletes it from the database.
 */
function deleteTrain() {
  if (CurrentUser === undefined || CurrentUser === null) {
    $('#authModal').modal(); // Restrict access to logged in users only. 
    return;
  }

  var uniqueKey = $(this).closest('tr').data('key');
  var childRef = dbRef.child(uniqueKey);

  childRef.remove().then(function () {
    console.log("Remove succeeded.");

  }).catch(function (error) {
    console.log("Remove failed: " + error.message);
  });

  $(this).closest('tr').remove();
} // END deleteTrain

/**
 * 2.5 editTrain
 * Gets uniqueKey from table-row and allows changing values and updates the database.
 * https://firebase.google.com/docs/reference/js/firebase.database.Reference.html#update
 */
function editTrain() {
  if (CurrentUser === undefined || CurrentUser === null) {
    $('#authModal').modal(); // Restrict access to logged in users only. 
    return;
  }

  var uniqueKey = $(this).closest('tr').data('key');

  rowArray = [];
  $(this).closest('tr').children().each(function () {
    rowArray.push($(this).text());
  });

  for (var i = 0; i < rowArray.length; i++) {
    var inputID = "#" + scheduleTableFields[i];
    $(inputID).val(rowArray[i]);
  }

  $("#add-train-form").data("key", uniqueKey);
  $("#add-train-form").data("action", "update");
  var plusIcon = $("<i>").addClass("fas fa-plus");
  $("#add-train").html("Update ").append(plusIcon);

} // END editTrain

/**
 * 2.6 trainMinutesAway
 * @param {string} firstTime - first time train runs HH:mm [military time]
 * @param {integer} minFrequency - 
 * @return {integer} minutesAway - time in minutes until next train. 
 */
var trainMinutesAway = function (firstTime, minFrequency) {
  if (firstTime === undefined || minFrequency === undefined) {
    return;
  }

  // First Time (pushed back 1 year to make sure it comes before current time)
  var firstTimeConverted = moment(firstTime, "HH:mm").subtract(1, "years");

  // Difference between the times
  var diffTime = moment().diff(moment(firstTimeConverted), "minutes");

  // Time apart (remainder)
  var tRemainder = diffTime % minFrequency;

  // Minute Until Train
  var minutesAway = minFrequency - tRemainder;

  return minutesAway;
} // END trainMinutesAway

/**
 * 2.7 updateTrainSchedule
 * Reads database and updates train schedule. Re-calculates 'next-arrival' and 'minutes-away'.
 */
var updateTrainSchedule = function () {
  dbRef.once('value', (snapshot) => {

    if (snapshot.numChildren() === 0) {
      return;
    }

    $("#train-schedule > tbody").empty();
    snapshot.forEach(function (snap) {

      var tableData = {};
      var firstTime = false;
      var uniqueKey = false;
      for (var property in snap.val()) {
        if (snap.val().hasOwnProperty(property)) {
          // console.log(property + " : " + snap.val()[property]);

          if (uniqueKey === false) {
            uniqueKey = snap.key;
          }

          if (scheduleTableFields.includes(property)) {
            tableData[property] = snap.val()[property];

          } else if (property === "train-start-time") {
            firstTime = snap.val()[property];
          }
        }
      }

      // Calculate 'next-arrival' time and 'minutes-away' 
      if (firstTime !== false && tableData.hasOwnProperty('train-frequency')) {
        var minutesAway = trainMinutesAway(firstTime, tableData["train-frequency"]);
        var nextTrain = moment().add(minutesAway, "minutes");

        tableData['next-arrival'] = moment(nextTrain).format("HH:mm A");
        tableData['minutes-away'] = minutesAway;
      }

      tableData['key'] = uniqueKey;
      addTrainToSchedule(tableData);

    }); // END snapshot.forEach(function(snap)

  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);

  }); // END dbRef.once('value', (snapshot) => {
}; // END updateTrainSchedule

/**
 * 2.8 startClock
 * Displays current time and continues counting the seconds. 
 * @param {string} divSelector - defaults to #clock
 */
var startClock = function (divSelector) {
  divSelector = (divSelector === undefined) ? "#clock" : divSelector;
  setInterval(function () {
      $(divSelector).html(moment().format('MMMM D, YYYY H:mm:ss A'));
    },
    1000);
}; // END startClock

/**
 * 2.9 updateCurrentUser
 * Gets the currently signed-in user if there is one. 
 */
var updateCurrentUser = function () {
  if (firebase.auth().currentUser !== null) {
    // User is signed in.
    CurrentUser = firebase.auth().currentUser;
    $("#sign-in").hide();
    $("#sign-out").show();
    $("#add-train-section").show();
    $("#user-display-name").html("Hello, " + CurrentUser.displayName + "&nbsp;&nbsp;&nbsp;|");

  } else {
    // No user is signed in.
    CurrentUser = null; // Force this to be null
    $("#sign-in").show();
    $("#sign-out").hide();
    $("#add-train-section").hide();
    $("#user-display-name").empty();
  }

  updateTrainSchedule();
  return;
}; // END CurrentUser

/**
 * 2.10 SignOut
 */
var SignOut = function () {
  firebase.auth().signOut().then(function () {
    // Sign-out successful.
    updateCurrentUser();

    // The start method will wait until the DOM is loaded.
    ui.start('#firebaseui-auth-container', uiConfig);
    console.log("Sign-out Successful");

  }).catch(function (error) {
    // An error happened.
    console.log("An Error happened", error);
  });
}; // END SignOut

/**===============[ 3. Document Ready ]==================== 
 * NOTE: $(function(){ === $(document).ready(function() {
 * it's the shorthand version of document ready. 
 *********************************************************/
$(function () {
  // 3.1 Watch Database + Initial Loader
  firebaseWatcher();

  // 3.2 Add Train on Submit
  $('#add-train-form').submit(addTrain);

  // 3.3 Update Train Schedule Every minute
  setInterval(updateTrainSchedule, 60 * 1000);
  startClock();

  // 3.4 Check if User Logged In and update CurrentUser global
  $("#sign-in").show();
  $("#sign-out").hide();
  $("#user-display-name").empty();
  $("#add-train-section").hide();
  setTimeout(updateCurrentUser, 1000);

  // 3.5 Delete Train on click
  $("#train-schedule").on('click', '.delete', deleteTrain);

  // 3.6 Edit Train on click
  $("#train-schedule").on('click', '.edit', editTrain);

}); // END document ready