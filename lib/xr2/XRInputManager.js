import XRController from './XRController.js';
import XRHand       from './XRHand.js';

export default class XRInputManager{
    // #region MAIN
    constructor( xrMan ){
        this.xr     = xrMan;
        this.list   = new Map();
    }
    // #endregion

    // #region GETTERS
    getLeftController(){  return this.list.get( 'left_ctrl' ); }
    getRightController(){ return this.list.get( 'right_ctrl' ); }
    getLeftHand(){  return this.list.get( 'left_hand' ); }
    getRightHand(){ return this.list.get( 'right_hand' ); }
    // #endregion

    // #region METHODS
    update(){
        const frame     = this.xr.frame;
        const refSpace  = this.xr.refSpace;
        let   key;
        let   itm;

        for( const src of frame.session.inputSources ){
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Get Input Object Wrapper
            key = ( !src.hand )? src.handedness + '_ctrl' : src.handedness + '_hand';
            itm = this.list.get( key );

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Create one if it doesn't exist
            if( !itm ){
                if( src.hand ){
                    itm = new XRHand( src.handedness, src );
                    this.xr.emit( 'newHand', itm );
                }else{
                    itm = new XRController( src.handedness ); 
                    this.xr.emit( 'newController', itm );
                }

                this.list.set( key, itm );
            }

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Update all the pos, rot & button states
            itm.update( frame, src, refSpace );
        }
    }
    // #endregion
}