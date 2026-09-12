import { useEffect, useState } from 'react';
import { UnifiedLab } from './components/UnifiedLab.tsx';
import { LAB_NAVIGATION_EVENT } from './lab/navigation.ts';

export function App() {
  const [, setRouteRevision] = useState(0);
  useEffect(() => {
    const update = () => setRouteRevision(value => value + 1);
    window.addEventListener(LAB_NAVIGATION_EVENT, update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener(LAB_NAVIGATION_EVENT, update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  const params = new URLSearchParams(window.location.search);
  const test = params.get('test');
  const backend = params.get('backend');
  const native = test === '14-open-world' || test === '04-gpu-lod' && backend !== 'legacy';
  return <UnifiedLab test={test ?? '00-baseline'} native={native} />;
}
