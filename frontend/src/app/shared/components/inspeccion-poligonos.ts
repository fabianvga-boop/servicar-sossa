/* Zonas tocables sobre assets/planilla-vehiculo.svg (lienzo de 1400 x 775). Generado a partir de la planilla. */

export interface Poligono {
  /** Código de la parte */
  z: string;
  d: string;
  /** Parte del otro lado cuando el costado se muestra espejado */
  zd?: string;
}

export const POLIGONOS: Record<'izquierda' | 'frente' | 'arriba' | 'atras', Poligono[]> = {
  izquierda: [
    {
      z: 'guardabarros_del_izq',
      d: 'M108 144 L265 95 L300 105 L300 228 L277 228 A79 79 0 0 0 119 228 L112 190 Z',
      zd: 'guardabarros_del_der'
    },
    {
      z: 'capo',
      d: 'M24,132 L120,112 L265,94 L300,98 L300,106 L150,122 L60,142 L28,152 Z'
    },
    {
      z: 'faros_delanteros',
      d: 'M30,145 L112,143 L96,190 L34,190 Z'
    },
    {
      z: 'parachoques_delantero',
      d: 'M4,192 L98,190 L124,205 L124,256 L30,238 L6,228 Z'
    },
    {
      z: 'puerta_del_izq',
      d: 'M300,105 L305,98 L460,25 L528,20 L527,100 L515,232 L302,235 Z',
      zd: 'puerta_del_der'
    },
    {
      z: 'puerta_tras_izq',
      d: 'M530,20 L678,32 L722,100 L667,213 L640,232 L518,232 L527,100 Z',
      zd: 'puerta_tras_der'
    },
    {
      z: 'guardabarros_tras_izq',
      d: 'M722 100 L860 86 L895 95 L898 168 L968 172 L966 214 L958 232 L836 246 L836 228 A80 80 0 0 0 678 228 L668 213 Z',
      zd: 'guardabarros_tras_der'
    },
    {
      z: 'techo',
      d: 'M292,97 L410,38 L515,12 L600,6 L700,18 L800,50 L862,74 L850,84 L780,52 L690,30 L600,20 L520,22 L460,28 L330,92 Z'
    },
    {
      z: 'luces_traseras',
      d: 'M892,98 L948,104 L952,142 L905,140 Z'
    },
    {
      z: 'parachoques_trasero',
      d: 'M832,186 L898,170 L968,172 L966,214 L958,232 L836,246 Z'
    },
    {
      z: 'espejo_izquierdo',
      d: 'M332,72 L370,72 L372,102 L335,102 Z',
      zd: 'espejo_derecho'
    }
  ],
  frente: [
    {
      z: 'techo',
      d: 'M1082,18 L1318,18 L1320,34 L1080,34 Z'
    },
    {
      z: 'parabrisas',
      d: 'M1080,34 L1320,34 L1347,97 L1053,97 Z'
    },
    {
      z: 'capo',
      d: 'M1052,100 L1348,100 L1330,125 L1275,148 L1125,148 L1070,125 Z'
    },
    {
      z: 'faros_delanteros',
      d: 'M1035,142 L1118,145 L1112,195 L1035,190 Z'
    },
    {
      z: 'faros_delanteros',
      d: 'M1282,145 L1365,142 L1365,190 L1288,195 Z'
    },
    {
      z: 'guardabarros_del_der',
      d: 'M1022,105 L1052,100 L1072,125 L1035,142 Z'
    },
    {
      z: 'guardabarros_del_izq',
      d: 'M1378,105 L1348,100 L1328,125 L1365,142 Z'
    },
    {
      z: 'parachoques_delantero',
      d: 'M1018,192 L1118,196 L1135,240 L1265,240 L1282,196 L1382,192 L1385,256 L1016,256 Z'
    },
    {
      z: 'parachoques_delantero',
      d: 'M1128,146 L1272,146 L1262,238 L1138,238 Z'
    },
    {
      z: 'espejo_derecho',
      d: 'M1000,75 L1045,72 L1050,100 L1005,100 Z'
    },
    {
      z: 'espejo_izquierdo',
      d: 'M1355,72 L1400,75 L1398,100 L1350,100 Z'
    },
    {
      z: 'llantas',
      d: 'M1015,255 L1065,255 L1065,298 L1018,298 Z'
    },
    {
      z: 'llantas',
      d: 'M1335,255 L1385,255 L1382,298 L1335,298 Z'
    }
  ],
  atras: [
    {
      z: 'techo',
      d: 'M1100,432 L1305,432 L1310,448 L1095,448 Z'
    },
    {
      z: 'luneta',
      d: 'M1090,450 L1315,450 L1330,500 L1075,500 Z'
    },
    {
      z: 'baul',
      d: 'M1052,503 L1348,503 L1368,575 L1032,575 Z'
    },
    {
      z: 'luces_traseras',
      d: 'M1048,520 L1095,525 L1100,565 L1045,570 Z'
    },
    {
      z: 'luces_traseras',
      d: 'M1305,525 L1352,520 L1355,570 L1300,565 Z'
    },
    {
      z: 'parachoques_trasero',
      d: 'M1020,590 L1380,590 L1385,668 L1015,668 Z'
    },
    {
      z: 'espejo_izquierdo',
      d: 'M1002,495 L1045,492 L1048,520 L1005,522 Z'
    },
    {
      z: 'espejo_derecho',
      d: 'M1355,492 L1398,495 L1395,522 L1352,520 Z'
    },
    {
      z: 'llantas',
      d: 'M1018,668 L1066,668 L1066,718 L1018,718 Z'
    },
    {
      z: 'llantas',
      d: 'M1335,668 L1383,668 L1383,718 L1335,718 Z'
    }
  ],
  arriba: [
    {
      z: 'parachoques_delantero',
      d: 'M3,470 L38,445 L38,700 L3,680 Z'
    },
    {
      z: 'capo',
      d: 'M38,480 L120,455 L297,425 L270,470 L258,570 L270,670 L300,712 L120,690 L38,655 Z'
    },
    {
      z: 'parabrisas',
      d: 'M297,425 L425,455 L412,570 L428,685 L300,712 L258,570 Z'
    },
    {
      z: 'techo',
      d: 'M425,455 L720,455 L715,570 L722,675 L428,685 L412,570 Z'
    },
    {
      z: 'luneta',
      d: 'M720,455 L850,450 L868,570 L855,685 L722,675 L715,570 Z'
    },
    {
      z: 'baul',
      d: 'M850,450 L905,410 L945,440 L955,570 L945,700 L905,730 L855,685 L868,570 Z'
    },
    {
      z: 'luces_traseras',
      d: 'M890,410 L945,440 L940,465 L895,440 Z'
    },
    {
      z: 'luces_traseras',
      d: 'M895,700 L940,675 L945,705 L892,735 Z'
    },
    {
      z: 'parachoques_trasero',
      d: 'M940,480 L968,510 L968,630 L940,665 Z'
    },
    {
      z: 'faros_delanteros',
      d: 'M25,440 L100,405 L118,420 L55,470 Z'
    },
    {
      z: 'faros_delanteros',
      d: 'M25,700 L100,735 L118,720 L55,672 Z'
    },
    {
      z: 'guardabarros_del_der',
      d: 'M100,405 L300,388 L297,425 L70,465 Z'
    },
    {
      z: 'puerta_del_der',
      d: 'M300,388 L535,388 L540,410 L372,418 L297,425 Z'
    },
    {
      z: 'puerta_tras_der',
      d: 'M535,388 L700,388 L724,402 L690,420 L540,410 Z'
    },
    {
      z: 'guardabarros_tras_der',
      d: 'M700,388 L820,385 L900,405 L940,440 L840,450 L724,402 Z'
    },
    {
      z: 'espejo_derecho',
      d: 'M340,418 L358,372 L380,366 L385,372 L372,410 Z'
    },
    {
      z: 'guardabarros_del_izq',
      d: 'M100,735 L300,752 L297,715 L70,675 Z'
    },
    {
      z: 'puerta_del_izq',
      d: 'M300,752 L535,752 L540,730 L372,722 L297,715 Z'
    },
    {
      z: 'puerta_tras_izq',
      d: 'M535,752 L700,752 L724,738 L690,720 L540,730 Z'
    },
    {
      z: 'guardabarros_tras_izq',
      d: 'M700,752 L820,755 L900,735 L940,700 L840,690 L724,738 Z'
    },
    {
      z: 'espejo_izquierdo',
      d: 'M340,722 L358,768 L380,774 L385,768 L372,730 Z'
    }
  ]
};
