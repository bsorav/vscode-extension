let prodDGraphDot = `digraph tfg {
    "L0%0%1_L0%0%1" -> "Lfor.cond%1%0_Lfor.cond%1%0"[label="L0%0%1-Lfor.cond%1%0 \l L0%0%1-Lfor.cond%1%0"]
    "Lfor.cond%1%0_Lfor.cond%1%0" -> "Lfor.cond%1%0_Lfor.cond%1%0"[label="Lfor.cond%1%0-Lfor.inc%1%1-Lfor.cond%1%0 \l Lfor.cond%1%0-Lfor.body%1%1-Lfor.body%4%1-Lfor.inc%1%1-Lfor.cond%1%0"]
    "Lfor.cond%1%0_Lfor.cond%1%0" -> "Lfor.cond%1%0_Lfor.cond3%1%0"[label="Lfor.cond%1%0-Lfor.cond%1%0 \l Lfor.cond%1%0-Lfor.end%1%1-Lfor.cond3%1%0"]
    "Lfor.cond%1%0_Lfor.cond3%1%0" -> "Lfor.cond%1%0_Lfor.cond3%1%0"[label="(Lfor.cond%1%0-Lfor.inc%1%1-Lfor.cond%1%0)^4 \l ((Lfor.cond3%1%0-Lfor.cond3%8%1-Lif.end85%1%0-Lfor.cond3%1%0)+(Lfor.cond3%1%0-Lfor.cond3%8%1-Lif.then7%1%1-Lif.then7%7%1-Lif.end15%1%1-Lif.end15%5%1-Lif.end24%1%1-Lif.end24%5%1-Lif.end34%1%1-Lif.end34%5%1-Lif.end44%1%1-Lif.end44%5%1-Lif.end54%1%1-Lif.end54%5%1-Lif.end64%1%1-Lif.end64%5%1-Lif.end74%1%1-Lif.end74%5%1-Lif.end85%1%0-Lfor.cond3%1%0))"]
    "Lfor.cond%1%0_Lfor.cond3%1%0" -> "E0%0%1_E0%0%1"[label="(Lfor.cond%1%0-Lfor.inc%1%1-Lfor.cond%1%0)^4-Lfor.end%1%1-E0%0%1 \l Lfor.cond3%1%0-Lfor.cond3%8%1-((Lif.then7%7%1-((Lif.end15%5%1-((Lif.end24%5%1-((Lif.end34%5%1-((Lif.end44%5%1-((Lif.end54%5%1-((Lif.end64%5%1-Lif.end74%1%1-Lif.end74%5%1-Lif.then79%1%1-Lreturn%1%0)+(Lif.end64%5%1-Lif.then69%1%1-Lreturn%1%0)))+(Lif.end54%5%1-Lif.then59%1%1-Lreturn%1%0)))+(Lif.end44%5%1-Lif.then49%1%1-Lreturn%1%0)))+(Lif.end34%5%1-Lif.then39%1%1-Lreturn%1%0)))+(Lif.end24%5%1-Lif.then29%1%1-Lreturn%1%0)))+(Lif.end15%5%1-Lif.then20%1%1-Lreturn%1%0)))+(Lif.then7%7%1-Lif.then11%1%1-Lreturn%1%0))-E0%0%1"]
    "Lfor.cond%1%0_Lfor.cond%1%0" -> "E0%0%1_E0%0%1"[label="((Lfor.cond%1%0-Lfor.inc%1%1-Lfor.cond%1%0)+(Lfor.cond%1%0))-Lfor.end%1%1-E0%0%1 \l Lfor.cond%1%0-Lfor.body%1%1-Lfor.body%4%1-Lif.then%1%1-Lreturn%1%0-E0%0%1"]
    }`;

let srcCode = 
`#include <stddef.h>

size_t strlen(char *s)
{
  char *p ;
  for (p = s; *p; ++p);
  return p-s ;
}
`;

let dstCode =
`#include <stddef.h>
#include <limits.h>

size_t strlen(char * str)
{
  char *ptr ;
  unsigned long *longword_ptr;
  unsigned long longword, himagic, lomagic;
  for (ptr = str; ((unsigned long)ptr & sizeof(unsigned long)) != 0; ++ptr)
    if (*ptr == '\0')
      return ptr-str ;
  longword_ptr = (unsigned long*)ptr ;
#if ULONG_MAX == 0xFFFFFFFFFFFFFFFF
  himagic = 0x8080808080808080L;
  lomagic = 0x0101010101010101L;
#else
  himagic = 0x80808080L;
  lomagic = 0x01010101L;
#endif
  for (;;)
  {
    longword = *longword_ptr++;
    if ((longword - lomagic) & ~longword & himagic) {
      char *cp = (char *)(longword_ptr - 1);
      if (cp[0] == 0) return cp - str ;
      if (cp[1] == 0) return cp - str + 1;
      if (cp[2] == 0) return cp - str + 2;
      if (cp[3] == 0) return cp - str + 3;
      if (cp[4] == 0) return cp - str + 4;
      if (cp[5] == 0) return cp - str + 5;
      if (cp[6] == 0) return cp - str + 6;
      if (cp[7] == 0) return cp - str + 7;
    }
  }
}
`;

let productGraph = {
    "nodes": [["S_1_1", "D_1_1"], ["S_6_15", "D_9_20"], ["S_6_15", "D_22_29"], ["S_8_1", "D_36_1"]],
    "edges": [
        {
            "from": ["S_1_1", "D_1_1"],
            "to": ["S_6_15", "D_9_20"],
            "path1": "S_1_1-S_6_15", 
            "path2":"D_1_1-D_9_20"
        },
        {
            "from": ["S_6_15", "D_9_20"],
            "to": ["S_6_15", "D_9_20"],
            "path1": "S_6_15-S_6_19-S_6_15", 
            "path2":"D_9_20-D_10_9-D_9_70-D_9_20"
        },
        {   
            "from": ["S_6_15", "D_9_20"],
            "to": ["S_6_15", "D_22_29"],
            "path1": "S_6_15-S_6_15",
            "path2" : "D_9_20-D_12_1-D_22_29"
        },
        {
            "from": ["S_6_15", "D_22_29"],
            "to" : ["S_6_15", "D_22_29"],
            "path1": "(S_6_15-S_6_19-S_6_15)^4",
            "path2": "((D_22_29-D_23_9-D_20_1-D_22_29)+(D_22_29-D_23_9-D_24_40-D_25_11-D_26_11-D_26_11-D_27_11-D_27_11-D_28_11-D_28_11-D_29_11-D_29_11-D_30_11-D_30_11-D_31_11-D_31_11-D_32_11-D_32_11-D_20_1-D_22_29))"
        },
        {
            "from": ["S_6_15", "D_22_29"],
            "to": ["S_8_1", "D_36_1"],
            "path1": "(S_6_15-S_6_19-S_6_15)^4-S_7_11-S_8_1",
            "path2": " D_22_29-D_23_9-((D_25_11-((D_26_11-((D_27_11-((D_28_11-((D_29_11-((D_30_11-((D_31_11-D_32_11-D_32_11-D_32_33-D_35_1)+(D_32_11-D_31_33-D_35_1)))+(D_31_11-D_30_33-D_35_1)))+(D_30_11-D_29_33-D_35_1)))+(D_29_11-D_28_33-D_35_1)))+(D_28_11-D_27_33-D_35_1)))+(D_27_11-D_26_33-D_35_1)))+(D_26_11-D_25_33-D_35_1))-D_36_1"
        },
        {
            "from": ["S_6_15", "D_9_20"],
            "to": ["S_8_1", "D_36_1"],
            "path1": "((S_6_15-S_6_19-S_6_15)+(S_6_15))-S_7_11-S_8_1",
            "path2": "D_9_20-D_10_11-D_10_11-D_11_17-D_35_1-D_36_1"
        }
    ]
};

export {productGraph, srcCode, dstCode};
