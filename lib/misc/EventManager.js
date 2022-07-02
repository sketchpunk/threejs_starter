class EventManager{
	constructor(){ 
		this.elm	= document.createElement("i");
		this.events	= {};
	}

	on( eName, func ){ 
		this.elm.addEventListener( eName, func );
		if( !this.events[ eName ] ) this.events[ eName ] = new Array();
		this.events[ eName ].push( func );
		return this;
	}

	off( eName, func ){ 
		this.elm.removeEventListener( eName, func );
		let idx = this.events[ eName ].indexOf( func );
		if( idx !== -1 ) this.events[ eName ].splice( idx, 1 );
		return this;
	}

	offAll( eName ){
		let ary = this.events[ eName ];
		if( !ary ) console.error( "EventManager.off_all : Event Name Not Found ", eName );
		else{
			let func;
			for( func of ary ) this.elm.removeEventListener( eName, func );
		}
		return this;
	}

	emit( eName, detail=null ){ 
		this.elm.dispatchEvent( new CustomEvent( eName, { detail, bubbles:true, cancelable:true, composed:false } ) ); 
		return this;
	}
}
export default EventManager;