export default class CanvasPointerHandlers{
    // #region MAIN
    _pointerId     = 0;         // Pointer ID to continue receiving events when mouse leaves canvas or window
    _initCoord     = [ 0, 0 ];  // mouse XY position on mouse down
    _prevCoord     = [ 0, 0 ];  // mouse XY position on last move
    _canvas        = null;

    onPointerUp    = null;
    onPointerDown  = null;
    onPointerMove  = null;
    onPointerWheel = null;

    constructor( canvas ){ this._canvas = canvas; }
    // #endregion

    // #region HELPERS
    /** Compute mouse XY position over the canvas */
    mouseCoord( e, out = [ 0, 0 ] ){
        // need canvas sceen location & size
        const rect = this._canvas.getBoundingClientRect();
        out[ 0 ]   = e.clientX - rect.x;
        out[ 1 ]   = e.clientY - rect.y;
        return out;
    }
    // #endregion

    // #region EVENT HANDLERS
    _onWheel = e => {
        e.preventDefault();
        e.stopPropagation();
        if( this.onPointerWheel ) this.onPointerWheel( e, e.deltaX, e.deltaY );
    };

    _onPointerDown = e => {
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this._pointerId = e.pointerId;
        vec2Copy( this.mouseCoord( e, this._initCoord ), this._prevCoord );

        if( this.onPointerDown ){
            if( !this.onPointerDown( e, this._initCoord ) ){
                return;
            }
        }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        e.preventDefault();
        e.stopPropagation();
        this._canvas.addEventListener( 'pointermove', this._onPointerMove, true );
        this._canvas.addEventListener( 'pointerup',   this._onPointerUp,   true );
    };

    _onPointerUp = e => {
        this._canvas.releasePointerCapture( this._pointerId );
        this._canvas.removeEventListener( 'pointermove', this._onPointerMove, true );
        this._canvas.removeEventListener( 'pointerup',   this._onPointerUp,   true );

        if( this.onPointerUp ) this.onPointerUp( e );
    };

    _onPointerMove = e => {
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        e.preventDefault();
        e.stopPropagation();
        this._canvas.setPointerCapture( this._pointerId ); // Keep receiving events
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Figure out the current position, change since initial position & velocity of from previous pos.
        const coord = this.mouseCoord( e );
        const delta = [ coord[ 0 ] - this._initCoord[ 0 ], coord[ 1 ] - this._initCoord[ 1 ] ];
        const vel   = [ coord[ 0 ] - this._prevCoord[ 0 ], coord[ 1 ] - this._prevCoord[ 1 ], ];

        vec2Copy( coord, this._prevCoord );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( this.onPointerMove ) this.onPointerMove( e, coord, delta, vel, this._initCoord );
    };

    _onContextMenu = e => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    // #endregion

    // #region CONTROL LISTENERS
    enable(){
        this._canvas.addEventListener( 'wheel',       this._onWheel,       true );
        this._canvas.addEventListener( 'pointerdown', this._onPointerDown, true );
        this._canvas.addEventListener('contextmenu', this._onContextMenu, true);
        // this._canvas.addEventListener( 'pointermove', (e)=>{console.log( e )}, true );
        return this;
    }

    disable(){
        if( this._pointerId ) this._canvas.releasePointerCapture( this._pointerId );

        this._canvas.removeEventListener( 'wheel',       this._onWheel,       true );
        this._canvas.removeEventListener( 'pointerdown', this._onPointerDown, true );
        this._canvas.removeEventListener( 'pointermove', this._onPointerMove, true );
        this._canvas.removeEventListener( 'pointerup',   this._onPointerUp,   true );
        this._canvas.removeEventListener('contextmenu', this._onContextMenu, true);
        return this;
    }
    // #endregion
}

// #region HELPERS
function vec2Copy( a, b ){
    b[ 0 ] = a[ 0 ];
    b[ 1 ] = a[ 1 ];
    b[ 2 ] = a[ 2 ];
}
// #endregion