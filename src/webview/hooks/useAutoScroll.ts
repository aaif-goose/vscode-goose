import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoScrollOptions {
  isStreaming: boolean;
  threshold?: number;
  contentRef?: RefObject<HTMLElement | null>;
}

interface UseAutoScrollReturn {
  scrollToBottom: () => void;
  isAtBottom: boolean;
}

const DEFAULT_THRESHOLD = 100;

export function useAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  options: UseAutoScrollOptions
): UseAutoScrollReturn {
  const { isStreaming, threshold = DEFAULT_THRESHOLD, contentRef } = options;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledUp = useRef(false);

  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [containerRef, threshold]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
    userScrolledUp.current = false;
    setIsAtBottom(true);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);

      if (atBottom) {
        userScrolledUp.current = false;
      } else if (isStreaming) {
        userScrolledUp.current = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, checkIfAtBottom, isStreaming]);

  useEffect(() => {
    if (isStreaming && !userScrolledUp.current) {
      const container = containerRef.current;
      if (!container) return;

      container.scrollTop = container.scrollHeight;
    }
  }, [containerRef, isStreaming]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef?.current;
    if (!container || !content || typeof ResizeObserver === 'undefined') return;

    const scrollIfNeeded = () => {
      if (isStreaming && !userScrolledUp.current) {
        container.scrollTop = container.scrollHeight;
      }
    };

    const observer = new ResizeObserver(scrollIfNeeded);
    observer.observe(content);

    return () => observer.disconnect();
  }, [containerRef, contentRef, isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      userScrolledUp.current = false;
    }
  }, [isStreaming]);

  return { scrollToBottom, isAtBottom };
}
