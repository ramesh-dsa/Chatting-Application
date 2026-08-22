import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import { Plasma } from '../components/backgrounds/plasma';

const pageVariants = {
  initial: ({ direction, shouldReduceMotion }: { direction: number, shouldReduceMotion: boolean }) => ({
    x: shouldReduceMotion ? 0 : direction > 0 ? 24 : -24,
    opacity: 0,
    scale: shouldReduceMotion ? 1 : 0.985
  }),
  in: {
    x: 0,
    opacity: 1,
    scale: 1
  },
  out: ({ direction, shouldReduceMotion }: { direction: number, shouldReduceMotion: boolean }) => ({
    x: shouldReduceMotion ? 0 : direction > 0 ? -24 : 24,
    opacity: 0,
    scale: shouldReduceMotion ? 1 : 0.985
  })
};

export default function AuthLayout() {
  const element = useOutlet();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  
  const [direction, setDirection] = useState(1);
  const prevPath = useRef(location.pathname);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setIsNavigating(true);
      if (prevPath.current === '/login' && location.pathname === '/signup') {
        setDirection(1); // Moving forward to signup
      } else if (prevPath.current === '/signup' && location.pathname === '/login') {
        setDirection(-1); // Moving back to login
      }
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center bg-black overflow-hidden font-sans">
      {/* Background stays mounted continuously */}
      <div className="absolute inset-0 z-0">
        <Plasma
          color="#8B5CF6"
          speed={1.0}
          mouseInteractive={false}
          renderScale={isMobile ? 0.45 : 0.7}
          maxDpr={isMobile ? 1.25 : 1.5}
          targetFps={60}
          iterations={isMobile ? 45 : 60}
          reducedMotion={shouldReduceMotion || false}
        />
      </div>

      <div className="relative z-10 w-full flex justify-center items-center px-4 py-8">
        <AnimatePresence 
          mode="popLayout" 
          custom={{ direction, shouldReduceMotion: shouldReduceMotion || false }}
          onExitComplete={() => setIsNavigating(false)}
        >
          <motion.div
            key={location.pathname}
            custom={{ direction, shouldReduceMotion: shouldReduceMotion || false }}
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={{ 
              duration: shouldReduceMotion ? 0.2 : 0.45, 
              ease: [0.22, 1, 0.36, 1] 
            }}
            className={`w-full flex justify-center ${isNavigating ? 'pointer-events-none' : ''}`}
          >
            {element}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
