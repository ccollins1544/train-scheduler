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
 * 
 * 1. Functions
 *   1.1 firebaseWatcher
 * 
 * 2. Document Ready
 *   2.1 Watch Database + Initial Loader
 *   2.2 Add Train on Submit
 * 
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig); 
var fdb = firebase.database();
var dbRef = fdb.ref("/trainScheduler");

/* ===============[ 1. Functions ]=======================*/
/**
 * 1.1 firebaseWatcher
 * @param {*} databaseReference 
 * @param {*} onChange - can be 'value' or 'child_added'
 */
var firebaseWatcher = function(databaseReference, onChange="value"){
  // set default database reference to our global dbRef
  databaseReference = (databaseReference === undefined) ? dbRef : databaseReference;

  // Firebase watcher + initial loader 
  databaseReference.on(onChange, function(snap){
    console.log(snap.val());

  }, function (errorObject){
    console.log("The read failed: " + errorObject.code);
  });

} // END firebaseWatcher

/**
 * addTrain
 * Gets form data from #add-train-form adds it to the database
 * @param {object} event 
 */
function addTrain(event){
  event.preventDefault();

  var formArray = $(this).serializeArray(); // $("#add-train-form").serializeArray();
  var formData = {}; // NOTE: {} creates and object and [] creates an Array.

  for (var i in formArray){
    var KEY = "";
    var VALUE = "";

    for(var key in formArray[i]){
      console.log(key+" => "+formArray[i][key]);

      if(key == "name"){
        KEY = formArray[i][key];

      }else if(key == "value"){
        VALUE = formArray[i][key];
      }

    }

    formData[KEY] = VALUE;
  }

  console.log(formData);
  
} // addTrain

/**===============[ 2. Document Ready ]==================== 
 * NOTE: $(function(){ === $(document).ready(function() {
 * it's the shorthand version of document ready. 
 *********************************************************/
$(function(){

  // 2.1 Watch Database + Initial Loader
  firebaseWatcher();

  // Debugging
  firebaseWatcher(fdb.ref("/bidderData"));

  // 2.2 Add Train on Submit
  $('#add-train-form').submit(addTrain);
  
});