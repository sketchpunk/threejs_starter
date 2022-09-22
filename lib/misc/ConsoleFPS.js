export default function ConsoleFPS(){
    let t = 0;
    let f = 0;

    return ( dt )=>{
        t += dt;
        f++;
        if( t >= 1 ){
            console.log( 'FPS:', f );
            t = 0;
            f = 0;
        }
    }
}