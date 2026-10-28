'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Shown when the backend is slow to answer: free hosts put it to sleep when nobody uses it. */
export default function WakingHint({ after = 5000 }: { after?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), after);
    return () => clearTimeout(t);
  }, [after]);
  if (!show) return null;
  return (
    <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="mx-auto max-w-sm text-sm text-fog">
      The server is waking up. On a free host it sleeps when nobody is using it, so the first visit can take up to a minute.
    </motion.p>
  );
}
