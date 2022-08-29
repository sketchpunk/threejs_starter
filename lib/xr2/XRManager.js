// #region MATHS
function vec3_norm( out, a ){
    let mag = Math.sqrt( a[ 0 ]**2 + a[ 1 ]**2 + a[ 2 ]**2 );
    if( mag != 0 ){
        mag      = 1 / mag;
        out[ 0 ] = a[ 0 ] * mag;
        out[ 1 ] = a[ 1 ] * mag;
        out[ 2 ] = a[ 2 ] * mag;
    }
    return out;
}
// #endregion

// Events : newSession, xrStart, xrEnd
export default class XRManager{
    // #region MAIN
    isActive = false;   // Has xrStart event been triggered yet
    session  = null;    // Reference to XR Session given by browser
    renderer = null;    // Threejs Renderer
    camera   = null;
    xrCamera = null;
    refSpace = null;    // Reference Space : https://developer.mozilla.org/en-US/docs/Web/API/XRReferenceSpace
    frame    = null;    // https://developer.mozilla.org/en-US/docs/Web/API/XRFrame

    
    constructor( renderer, camera ){ 
        this.renderer = renderer;
        this.camera   = camera;
    }
    // #endregion

    // #region XR Position & Orientation
    updateXRCamera(){
        this.xrCamera = this.renderer.xr.getCamera();
        this.xrCamera.updateWorldMatrix( true, false );
        return this;
    }

    getXRWorldPosition( out=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        out[ 0 ]  = elm[ 12 ];
        out[ 1 ]  = elm[ 13 ];
        out[ 2 ]  = elm[ 14 ];
        return out;
    }

    getXRWorldForward( out=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        out[ 0 ]  = -elm[ 8 ];
        out[ 1 ]  = -elm[ 9 ];
        out[ 2 ]  = -elm[ 10 ];
        return vec3_norm( out, out );
    }

    getXRWorldAxis( x=[0,0,0], y=[0,0,0], z=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        
        x[ 0 ] = elm[ 0 ];
        x[ 1 ] = elm[ 1 ];
        x[ 2 ] = elm[ 2 ];
        vec3_norm( x, x );

        y[ 0 ] = elm[ 4 ];
        y[ 1 ] = elm[ 5 ];
        y[ 2 ] = elm[ 6 ];
        vec3_norm( y, y );
         
        // VR Camera's forward is negative z direction
        z[ 0 ] = -elm[ 8 ];  
        z[ 1 ] = -elm[ 9 ];
        z[ 2 ] = -elm[ 10 ];
        vec3_norm( z, z );

        //return [ x, y, z ];
    }
    // #endregion

    // #region GETTERS
    async isAvailable(){
        if( 'xr' in navigator ){
            return await navigator.xr.isSessionSupported( 'immersive-vr' );
        }
        return false;
    }
    // #endregion

    // #region SESSION
    endSession(){ if( this.session ){ this.session.end(); this.session = null; } }
    
    async requestSession(){
        if( ! await this.isAvailable() ){   console.log( 'Browser has no support for WebXR' );
        }else if( this.session ){           console.log( 'Session already opened' );
        }else{
            try{
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Get session
                const session = await navigator.xr.requestSession( 'immersive-vr', { 
                    optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'layers' ]
                } );
                
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Session setups
                this.session    = session;
                this.refSpace   = await session.requestReferenceSpace( 'local-floor' );

                session.addEventListener( 'end', ( e )=>{
                    console.log( 'Session Ended' );
                    this.isActive = false;
                } );

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Give session to 3JS
                this.renderer.xr.setSession( this.session );

                this.emit( 'newSession', session );
                return true;
            }catch( ex ){
                console.log( 'error', ex );
            }
        }

        return false;
    }
    // #endregion

    // #region EVENTS
    onRender( frame, time ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Test when XR turns On/Off from 3JS
        if( this.renderer.xr.isPresenting && !this.isActive ){       this.isActive = true;  this.emit( 'xrStart', frame ); }
        else if( !this.renderer.xr.isPresenting && this.isActive ){  this.isActive = false; this.emit( 'xrEnd' ); }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.frame = frame;

        // TODO: Get User's position

        return this.renderer.xr.isPresenting;
    }

    // Available: end, select, selectstart, selectend, squeeze, squeezestart, squeezeend, inputsourceschange
    onSessionEvent( evtName, fn ){ this.session.addEventListener( evtName, fn ); return this; }
    
    on( evtName, fn, once=false ){ document.body.addEventListener( evtName, fn, { once } ); return this; }
    off( evtName, fn ){ document.body.removeEventListener( evtName, fn ); return this; }

    emit( evtName, payload ){
        document.body.dispatchEvent( new CustomEvent( evtName, { 
            detail      : payload,
            bubbles     : false,
            cancelable  : true,
            composed    : false,
        }) );
        return this;
    }
    // #endregion
}