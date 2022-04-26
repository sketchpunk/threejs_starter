const PROFILES = {
    'oculus-touch-v3':{
        hands :{
            left : {
                buttons:{
                    trigger    : { index: 0 },
                    squeeze    : { index: 1 },
                    thumbstick : { index: 3 },
                    x          : { index: 4 },
                    y          : { index: 5 },
                    thumbrest  : { index: 6 },
                },

                axes : {
                    x: { index: 2, sign:1, },
                    y: { index: 3, sign:-1, },
                }
            },

            right : {
                buttons:{
                    trigger    : { index: 0 },
                    squeeze    : { index: 1 },
                    thumbstick : { index: 3 },
                    a          : { index: 4 },
                    b          : { index: 5 },
                    thumbrest  : { index: 6 },
                },

                axes : {
                    x: { index: 2, sign:1,  },
                    y: { index: 3, sign:-1,  }, // Up is a negative, so invert the value so forward direction is a positive number
                }
            }
        }
    }
}

export default PROFILES;