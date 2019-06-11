/**
 * Title: Attribute Persistence Example for Alexa Node.js SDK
 *
 * This is an example of how to grab a user's details from DynamoDB on skill launch,
 * replace the session attributes with the persistent attributes, and then
 * copy session attributes to persistent attributes on skill exit.
 *
 */

'use strict';

// Use the ASK SDK for v2
const Alexa = require('ask-sdk');

/**
 * If this is the first start of the skill, grab the user's data from Dynamo and
 * set the session attributes to the persistent data.
 */
const GetUserDataInterceptor = {
  process (handlerInput) {
    let attributes = handlerInput.attributesManager.getSessionAttributes();
    if (
      handlerInput.requestEnvelope.request.type === 'LaunchRequest' &&
      !attributes['isInitialized']
    ) {
      return new Promise((resolve, reject) => {
        handlerInput.attributesManager
          .getPersistentAttributes()
          .then(attributes => {
            attributes['isInitialized'] = true;
            saveUser(handlerInput, attributes, 'session');
            resolve();
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
};

function saveUser (handlerInput, attributes, mode) {
  if (mode === 'session') {
    handlerInput.attributesManager.setSessionAttributes(attributes);
  } else if (mode === 'persistent') {
    console.info('Saving to Dynamo: ', attributes);
    return new Promise((resolve, reject) => {
      handlerInput.attributesManager
        .getPersistentAttributes()
        .then(persistent => {
          delete attributes['isInitialized'];
          handlerInput.attributesManager.setPersistentAttributes(attributes);

          resolve(handlerInput.attributesManager.savePersistentAttributes());
        })
        .catch(error => {
          reject(error);
        });
    });
  }
}

const LaunchHandler = {
  canHandle (handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle (handlerInput) {
    console.info('LaunchRequest');
    let attributes = handlerInput.attributesManager.getSessionAttributes();
    console.info('Test the load: ' + attributes['isInitialized']);

    attributes['FOO'] = 'BAR';
    saveUser(handlerInput, attributes, 'persistent');

    return handlerInput.responseBuilder.speak('Hello').reprompt('Hello').getResponse();
  }
};

exports.handler = Alexa.SkillBuilders
  .standard()
  .addRequestHandlers(LaunchHandler)
  .addRequestInterceptors(GetUserDataInterceptor)
  .withTableName('SkillUsers')
  .withAutoCreateTable(true)
  .withDynamoDbClient()
  .lambda();
