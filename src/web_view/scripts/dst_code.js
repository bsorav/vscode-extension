let code = 
`s441 :
    r1 = 0
        xmm1 = a [ r1 .. r1 +3]
        xmm2 = xmm1 + b [ r1 .. r1 +3]* c [ r1 .. r1 +3]
        xmm3 = xmm1 + b [ r1 .. r1 +3]* b [ r1 .. r1 +3]
        xmm4 = xmm1 + c [ r1 .. r1 +3]* c [ r1 .. r1 +3]

        xmm0 = ( d [ r1 ] < 0) , .. , ( d [ r1 +3] < 0)
        xmm1 = xmm0 ? xmm2 : xmm1 // pblendvb

        xmm0 = ( d [ r1 ] == 0) , .. , ( d [ r1 +3] == 0)
        xmm1 = xmm0 ? xmm3 : xmm1 // pblendvb

        xmm0 = ( d [ r1 ] > 0) , .. , ( d [ r1 +3] > 0)
        xmm1 = xmm0 ? xmm4 : xmm1 // pblendvb
        a [ r1 .. r1 +3] = xmm1
        r1 += 4
        if ( r1 != LEN ) goto A3
    ret`;