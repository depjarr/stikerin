import { useEffect, useState } from 'react';

// 'phone'  = HP tegak
// 'tablet' = tablet tegak
// 'desk'   = laptop/PC, atau HP/tablet yang lagi dimiringin (landscape)
function read() {
  const w = window.innerWidth, h = window.innerHeight;
  if (h >= w) return w < 700 ? 'phone' : 'tablet';
  return 'desk';
}

export default function useLayoutMode() {
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const on = () => setMode(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return mode;
}
