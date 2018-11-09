const alexaSDK = require('alexa-sdk');

const request = require('request');


var mysql = require('mysql');



const instructions = `Welcome to Nutrition Assistant. 
                      The following commands are available: add food, get summary, 
                      and delete food. What would you like to do?`;

const handlers = {

  /**
   * Triggered when the user says "Alexa, open Nutrition App.
   */
  'LaunchRequest'() {
    this.emit(':ask', instructions);
  },

  /**
   * Adds a recipe to the current user's saved recipes.
   * Slots: FoodName, Servings
   */
  'AddFoodIntent'() {
    var connection = mysql.createConnection({
      host: 'advsoft.codryjh8aaby.us-west-2.rds.amazonaws.com',
      user: 'devsoft',
      password: 'Test2018',
      port: 3306,
      database: 'mydb'
    });
    var self = this; 
    const { userId } = this.event.session.user;
    const { slots } = this.event.request.intent;

    // prompt for slot values and request a confirmation for each

    // RecipeName
    if (!slots.FoodName.value) {
      const slotToElicit = 'FoodName';
      const speechOutput = 'What is the name of the food?';
      const repromptSpeech = 'Please tell me the name of the food';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }
    else if (slots.FoodName.confirmationStatus !== 'CONFIRMED') {

      if (slots.FoodName.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'FoodName';
        const speechOutput = `The name of the food is ${slots.FoodName.value}, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'FoodName';
      const speechOutput = 'What is the name of the food you would like to add?';
      const repromptSpeech = 'Please tell me the name of the food';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    // Servings
    if (!slots.Servings.value) {
      const slotToElicit = 'Servings';
      const speechOutput = 'How many servings did you eat?';
      const repromptSpeech = 'Please tell me how many servings you ate.';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }
    else if (slots.Servings.confirmationStatus !== 'CONFIRMED') {

      if (slots.Servings.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'Servings';
        const speechOutput = `You ate ${slots.Servings.value} servings, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'Servings';
      const speechOutput = 'How many servings did you eat?';
      const repromptSpeech = 'Please tell me how many servings you ate.';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }



    // all slot values received and confirmed, now add the record to DynamoDB

    const name = slots.FoodName.value;
    const servings = slots.Servings.value;
    const dynamoParams = {
      TableName: foodTable,
      Item: {
        Name: name,
        UserID: userId,
        Servings: servings,
      }
    };

    function nutritionXRequest(resultData) {
        
        const query = {
          "query": servings + " " + name
        };
        return new Promise(function (resolve, reject) {
          if (resultData.length == 0){
          request.post('https://trackapi.nutritionix.com/v2/natural/nutrients?x-app-id=3df821eb&x-app-key=5b77ca7b5191dd5bd62f43dfb5826d1c', {
            json: query,
            headers: {
              "content-type": "application/json",
            },
          },(err, resp, body) => {
              if (err) {
                reject(err);
              } else {
                if(body.hasOwnProperty('foods')){
                  var sql = `Insert into FoodNutrition(IDFoodNutrition, foodName, total_calories, calories_from_fats,serving_size_value) values (?,?,?,?,?)`;
                  connection.query(sql, [body.foods[0].tags.tag_id, body.foods[0].food_name, body.foods[0].nf_calories,body.foods[0].nf_total_fat, servings], function (err, result) {
                    if (err) throw err;
                    resolve(body.foods[0].tags.tag_id);
                  });
                }else{
                  self.emit(':tell', `Sorry, we don't have that food.`);
                }
              }
            })
          }else{
                var sql = `Select IDFoodNutrition from FoodNutrition where foodName = ?`;
                connection.query(sql, name, function (err, result) {
                  if (err) reject(err);
                  resolve(result[0].IDFoodNutrition);
                });
              }
        })


      
    };
    function checkFood(food) {
      return new Promise(function (resolve, reject) {

        connection.connect(function (err) {
          if (err) {
            reject(err);
          }
          else {
            
            var sql = `Select IDFoodNutrition from FoodNutrition where foodName = ?`;
            
            
            connection.query(sql, food, function (err, result) {
              if (err) throw err;
              resolve(result);
            });
            
          }
        });
      })
    };
    function postRequest(foodId) {
      
      return new Promise(function (resolve, reject) { 

        var date = new Date();
        var sql = "INSERT INTO FoodLog (User_idUser, FoodNutrition_IDFoodNutrition, quanity, Time_Stamp) VALUES (?, ?, ?, ?)";
        let values = [2000,foodId,servings,date];
        connection.query(sql, values, function (err, result) {
          if (err){ console.log(err); reject(err);}
          else{
          
          resolve(result);
          }
        });
      })
    };

    var apiPromise = checkFood(name);


    apiPromise.then(function(resultData){
      var checkPromise = nutritionXRequest(resultData);
      
      checkPromise.then(function (foodId) {
        
        var dbInsertPromise = postRequest(foodId);
        dbInsertPromise.then(function(result){

          self.emit(':tell', `${name} added!`);
        }, function(err){

        }).then(function (result){
        
        })
        
      }, function (err) {
        console.log(err);
      }).then(function (result) {
      
        
      });
    });



  },

  /**
   * Lists all saved recipes for the current user. The user can filter by quick or long recipes.
   * Slots: GetFood
   */
  'GetSummaryIntent'() {
    var self = this;
    output = 'You ate: <break strength="x-strong" />';
    var connection = mysql.createConnection({
      host: 'HOST_NAME',
      user: 'USER_NAME',
      password: 'PASSWORD',
      port: 3306,
      database: 'DBNAME'
    });

    connection.connect(function (err) {
      if (err) {
        throw(err);
      }
      else {
        var sql = `select  SUM(FoodLog.quanity) as quantity, FoodNutrition.foodName, SUM(FoodNutrition.total_calories) as calories  from FoodLog Inner Join FoodNutrition where FoodLog.FoodNutrition_IDFoodNutrition = FoodNutrition.IDFoodNutrition and FoodLog.User_idUser=?  group by FoodLog.FoodNutrition_IDFoodNutrition`;

        connection.query(sql, 2000, function (err, result) {
          var foodlogs = [];
          if (err) throw err;

       
          result.forEach(foodlog=> {
            console.log('log', foodlog);
            foodlogs.push(foodlog);
         
            output += `${foodlog.quantity} ${foodlog.foodName}, <break strength="x-strong" />`; 
            

          }); 
          console.log("lenght", foodlogs.length);
          if (foodlogs.length == 0) {
            self.emit(':tell', 'It seems you have not ate anything yet');
          }else{
            self.emit(':tell', output);
          }
           
        });
      }
    });

   },


  /**
   * Allow the user to delete one of their foods.
   */
  'DeleteFoodIntent'() {
    var connection = mysql.createConnection({
      host: 'HOST_NAME',
      user: 'USER_NAME',
      password: 'PASSWORD',
      port: 3306,
      database: 'DBNAME'
    });
    var self = this;
    const { slots } = this.event.request.intent;

    // prompt for the food name if needed and then require a confirmation
    if (!slots.FoodName.value) {
      const slotToElicit = 'FoodName';
      const speechOutput = 'What is the name of the food you would like to delete?';
      const repromptSpeech = 'Please tell me the name of the food';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }
    else if (slots.FoodName.confirmationStatus !== 'CONFIRMED') {

      if (slots.FoodName.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'FoodName';
        const speechOutput = `You would like to delete ${slots.FoodName.value}, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'FoodName';
      const speechOutput = 'What is the name of the food you would like to delete?';
      const repromptSpeech = 'Please tell me the name of the food';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    const { userId } = this.event.session.user;

    connection.connect(function (err) {
      if (err) {
        reject(err);
      }
      else {
        

        const foodName = slots.FoodName.value;

    
        console.log('foodname', foodName);
        var sql = "delete from FoodLog where User_idUser = ? and FoodNutrition_IDFoodNutrition = (Select IDFoodNutrition from FoodNutrition where FoodNutrition.foodName = ?)";
               
        connection.query(sql, [2000, foodName], function (err, result) {
          if (err) throw err;
          console.log(result)
          self.emit(':tell', `Food ${foodName} deleted!`);
        });
       
      }
    });

 },

  'Unhandled'() {
    console.error('problem', this.event);
    this.emit(':ask', 'An unhandled problem occurred!');
  },

  'AMAZON.HelpIntent'() {
    const speechOutput = instructions;
    const reprompt = instructions;
    this.emit(':ask', speechOutput, reprompt);
  },

  'AMAZON.CancelIntent'() {
    this.emit(':tell', 'Goodbye!');
  },

  'AMAZON.StopIntent'() {
    this.emit(':tell', 'Goodbye!');
  }
};

exports.handler = function handler(event, context) {
  const alexa = alexaSDK.handler(event, context);
  alexa.registerHandlers(handlers);
  alexa.execute();
};