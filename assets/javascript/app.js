/*********************************************************
 * Train Scheduler
 * @package Train Scheduler
 * @author Christopher Collins
 * @version 1.0.0
 * @license none (public domain)
 * 
 * ===============[ TABLE OF CONTENTS ]===================
 * 0. Globals
 *   0.1 Firebase Configuration
 *   0.2 Initialize Firebase
 *   0.3 scheduleTableFields
 * 
 * 1. Functions
 *   1.1 firebaseWatcher
 *   1.2 addTrainToSchedule
 *   1.3 addTrain
 *   1.4 trainMinutesAway
 *   1.5 updateTrainSchedule
 * 
 * 2. Document Ready
 *   2.1 Watch Database + Initial Loader
 *   2.2 Add Train on Submit
 *   2.3 Update Train Schedule Every minute
 * 
 * @todo
 * -Update 'next-arrival' and 'minutes-away' every minute. 
 * -Add [update] and [remove] buttons for each train. Updating should allow changing: name, destination, and arrival time (where arrival time is relation to first-train-time).
 * -Make so only users that log into the site with their google or github accounts can use your site. Check out Firebase authentication.
 *********************************************************/
/* ===============[ 0. GLOBALS ]=========================*/
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

// 0.3 scheduleTableFields 
var scheduleTableFields = ["train-name", "train-destination", "train-frequency", "next-arrival", "minutes-away"];

/* ===============[ 1. Functions ]=======================*/
/**
 * 1.1 firebaseWatcher
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
    // console.log(snap.val());

    var tableData = {};
    var firstTime = false;
    for (var property in snap.val()) {
      if (snap.val().hasOwnProperty(property)) {
        // console.log(property + " : " + snap.val()[property]);

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

      tableData['next-arrival'] = moment(nextTrain).format("HH:mm");
      tableData['minutes-away'] = minutesAway;
    }

    console.log("TableData", tableData);
    addTrainToSchedule(tableData);

  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });

} // END firebaseWatcher

/**
 * 1.2 addTrainToSchedule
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

  $("#train-schedule > tbody").append(newRow);
} // END addTrainToSchedule

/**
 * 1.3 addTrain
 * Gets form data from #add-train-form adds it to the database.
 * @param {object} event 
 */
function addTrain(event) {
  event.preventDefault();

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
    formData[KEY] = VALUE;
  }

  formData.dateAdded = firebase.database.ServerValue.TIMESTAMP;
  dbRef.push(formData);

  // Clear Form Values
  $("#add-train-form *").filter(":input").each(function () {
    $(this).val("");
  });

} // END addTrain

/**
 * 1.4 trainMinutesAway
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
 * 1.5 updateTrainSchedule
 */
var updateTrainSchedule = function () {
  dbRef.once('value', (snapshot) => {
  
    if (snapshot.numChildren() === 0) { return; }
    
    $("#train-schedule > tbody").empty();
    snapshot.forEach(function (snap) {

      var tableData = {};
      var firstTime = false;
      for (var property in snap.val()) {
        if (snap.val().hasOwnProperty(property)) {
          // console.log(property + " : " + snap.val()[property]);

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

        tableData['next-arrival'] = moment(nextTrain).format("HH:mm");
        tableData['minutes-away'] = minutesAway;
      }

      console.log("TableData", tableData);
      addTrainToSchedule(tableData);

    }); // END snapshot.forEach(function(snap)

  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);

  }); // END dbRef.once('value', (snapshot) => {
}; // END updateTrainSchedule

/**===============[ 2. Document Ready ]==================== 
 * NOTE: $(function(){ === $(document).ready(function() {
 * it's the shorthand version of document ready. 
 *********************************************************/
$(function () {
  // 2.1 Watch Database + Initial Loader
  firebaseWatcher();

  // 2.2 Add Train on Submit
  $('#add-train-form').submit(addTrain);

  // 2.3 Update Train Schedule Every minute
  var intervalID = setInterval(updateTrainSchedule, 60 * 1000);

}); // END document ready