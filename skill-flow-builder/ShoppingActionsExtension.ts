import { InstructionExtension, InstructionExtensionParameter, DriverExtension, 
    DriverExtensionParameter, StoryStateHelper, SceneDirectionBuilder} from '@alexa-games/sfb-f';

/**
 * Custom Instruction Extension
 */
export class ShoppingExtension implements InstructionExtension, DriverExtension {
    private handlerInput: any;
    private products: any;
    private enterShopping:boolean;
    private shoppingWorkflowType: string;
    private activeProductASIN: string;
    
    public constructor(asins:any) {
        this.products = asins;
        this.enterShopping = false;
        this.shoppingWorkflowType = "";
        this.activeProductASIN = "";
    }
    
    /**
    * Runs before the request is sent to the story handlers. 
    * @param param 
    */
    public async pre(param: DriverExtensionParameter): Promise<void> {
        this.handlerInput = param.userInputHelper.getHandlerInput() || null;
        param.storyState.marketplace = this.handlerInput.requestEnvelope.request.locale || false;

        if (this.handlerInput && this.handlerInput.requestEnvelope.request.type == "SessionResumedRequest") {
            StoryStateHelper.setStoryPaused(param.storyState, false);

            // Since choices are removed on SessionResumed, establish choices for result now
            let successChoice = {
                id: "shopping result success",
                sceneDirections: new SceneDirectionBuilder().goTo(param.storyState.successTarget).build(),
                utterances: ["Shopping.SUCCESS"],
                saveToHistory: false
            };
            let declinedChoice = {
                id: "shopping result decline",
                sceneDirections: new SceneDirectionBuilder().goTo(param.storyState.declineTarget).build(),
                utterances: ["Shopping.DECLINED"],
                saveToHistory: false
            };
            let errorChoice = {
                id: "shopping result error",
                sceneDirections: new SceneDirectionBuilder().goTo(param.storyState.errorTarget).build(),
                utterances: ["Shopping.ERROR"],
                saveToHistory: false
            };

            StoryStateHelper.enqueueAvailableChoice(param.storyState, successChoice);
            StoryStateHelper.enqueueAvailableChoice(param.storyState, declinedChoice);
            StoryStateHelper.enqueueAvailableChoice(param.storyState, errorChoice);

            console.info("Choices: ",StoryStateHelper.getAvailableChoices(param.storyState));
            param.userInputHelper.setInputIntent(this.parseAlexaShoppingResponse(this.handlerInput.requestEnvelope));
        }
    }

    /**
     * Runs after the request is sent to the story handlers. 
     * @param param 
     */
    public async post(param: DriverExtensionParameter): Promise<void> {
        this.handlerInput = param.userInputHelper.getHandlerInput() || null;
        if (this.enterShopping && this.handlerInput) {
            let directive = undefined;
            switch (this.shoppingWorkflowType) {
                case "cart": {
                    directive = this.generateCartDirective(this.activeProductASIN);
                    break;
                }
                case "purchase": {
                    directive = this.generatePurchaseDirective(this.activeProductASIN);
                    break;
                }
            }
            if (directive) {
                this.handlerInput.responseBuilder.speak("").reprompt("").addDirective(directive).withShouldEndSession(undefined);
            }
        }

    }

    public async cart(param: InstructionExtensionParameter): Promise<void> {
        this.shoppingWorkflowType = "cart";
        this.registerShoppingChoices(param);
    }

    public async purchase(param: InstructionExtensionParameter): Promise<void> {
        this.shoppingWorkflowType = "purchase";
        this.registerShoppingChoices(param);
    }

    registerShoppingChoices(param:any) {
        const instructionParam:any = param.instructionParameters;
        const successTarget:string = instructionParam.success ? instructionParam.success.trim() : "";
        const failTarget:string = instructionParam.fail ? instructionParam.fail.trim() : "";
        const declineTarget:string = instructionParam.declined ? instructionParam.declined.trim() : failTarget;
        const errorTarget:string = instructionParam.error ? instructionParam.error.trim() : failTarget;

        this.enterShopping = true;
        let product:string = instructionParam.product;

        if (this.products && this.products.hasOwnProperty(product)){
            if (this.products[product].hasOwnProperty(param.storyState.marketplace)) {
                this.activeProductASIN = this.products[product][param.storyState.marketplace].asin;
            } else {
                throw new Error(`[ShoppingExtension Syntax Error] shopping locale for product not in the Products.json file.`);
            }
        }
        else {
            throw new Error(`[ShoppingExtension Syntax Error] shopping product=[${instructionParam.product}] is not in the Products.json file.`);
        }

        if (this.enterShopping) {
            param.storyState.successTarget = successTarget;
            param.storyState.declineTarget = declineTarget;
            param.storyState.errorTarget = errorTarget;
        }
    }

    parseAlexaShoppingResponse(response:any) {
        let purchaseResult:string = "ERROR";
        if (response.request.cause) {
            const token = response.request.cause.token;
            const status = response.request.cause.status;
            const code = status.code;
            const message = status.message;
            const payload = response.request.cause.result;

            console.info(`[Shopping Response] ${JSON.stringify(response)}`);

            console.info(`[INFO] Shopping Action Result: Code - ${code}, Message - ${message}, Payload - ${payload}`);

            switch(code) {
                case '200':
                    if (typeof payload !== "undefined") {
                        console.info(`[INFO] Shopping Action had an issue while performing the request.`);
                    }

                    if (token === "AddToShoppingCartToken" || token === "PurchaseProductToken") {
                        purchaseResult = "SUCCESS";
                        console.info(`[INFO] Shopping Action: Action was a success for ${token}.`)
                    }
                    break;
                default : 
                    console.info(`[INFO] Shopping Action: There was a problem performing the shopping action.`)
            }
        }
        return `Shopping.${purchaseResult}`;
    }

    generateCartDirective(asin:string) {
        let actionTask = {
            'type': 'Connections.StartConnection',
            'uri': 'connection://AMAZON.AddToShoppingCart/1',
            'input': {
                 'products' : [
                   {
                     'asin' : asin
                   }
                 ]
              },
            'token': 'AddToShoppingCartToken'
        };
        return actionTask;
    }

    generatePurchaseDirective(asin:string) {
        let actionTask = {
            'type': 'Connections.StartConnection',
            'uri': 'connection://AMAZON.BuyShoppingProducts/1',
            'input': {
                 'products' : [
                   {
                     'asin' : asin
                   }
                 ]
              },
            'token': 'PurchaseProductToken'
        };
        return actionTask;
    }
}