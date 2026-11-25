import React, { useEffect, useRef, useState } from 'react';
import { BoardCell, HandCard, MatchPhase, Owner } from '../../types/game';
import { sound } from '../../utils/sound';

interface UseBoardDragParams {
  board: BoardCell[][];
  phase: MatchPhase;
  turn: Owner;
  isAnimating: boolean;
  playerHand: HandCard[];
  onSelectHandUid: (uid: string | null) => void;
  onExecutePlayerMove: (uid: string, row: number, col: number) => void;
  timersRef: React.MutableRefObject<number[]>;
}

export function useBoardDrag({
  board,
  phase,
  turn,
  isAnimating,
  playerHand,
  onSelectHandUid,
  onExecutePlayerMove,
  timersRef,
}: UseBoardDragParams) {
  const [draggingCard, setDraggingCard] = useState<{
    card: HandCard;
    width: number;
    originLeft: number;
    originTop: number;
    returning: boolean;
  } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [scrubCardUid, setScrubCardUid] = useState<string | null>(null);

  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const mobileHandFanRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const hoverCellRef = useRef<{ row: number; col: number } | null>(null);
  const suppressHandClickUntilRef = useRef<number>(0);
  const scrubCardUidRef = useRef<string | null>(null);
  const playerHandRef = useRef<HandCard[]>(playerHand);
  const canPlayerPlayRef = useRef<boolean>(false);

  const cachedCellsRef = useRef<
    { row: number; col: number; left: number; right: number; top: number; bottom: number }[]
  >([]);

  const mobileScrubRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startCard: HandCard;
    startRect: { left: number; top: number; width: number; height: number };
    fanLeft: number;
    fanRight: number;
    fanTop: number;
    mode: 'pending' | 'scrubbing';
    activeUid: string;
  } | null>(null);

  const dragPendingRef = useRef<{
    card: HandCard;
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    width: number;
    offsetX: number;
    offsetY: number;
    active: boolean;
    curX: number;
    curY: number;
    targetX: number;
    targetY: number;
    tilt: number;
  } | null>(null);

  playerHandRef.current = playerHand;
  canPlayerPlayRef.current = phase === 'playing' && turn === 'player' && !isAnimating;

  useEffect(() => {
    if (phase !== 'playing') {
      mobileScrubRef.current = null;
      scrubCardUidRef.current = null;
      setScrubCardUid(null);
    }
    if (phase !== 'playing' || turn !== 'player' || isAnimating) {
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      dragPendingRef.current = null;
      setDraggingCard(null);
      setHoverCell(null);
      hoverCellRef.current = null;
    }
  }, [isAnimating, phase, turn]);

  useEffect(() => {
    const startPhysicsLoop = () => {
      if (dragRafRef.current !== null) return;
      const tick = () => {
        const d = dragPendingRef.current;
        const ghost = dragGhostRef.current;
        if (!d || !d.active) {
          dragRafRef.current = null;
          return;
        }
        const dx = d.targetX - d.curX;
        const dy = d.targetY - d.curY;
        d.curX += dx * 0.42;
        d.curY += dy * 0.42;
        const targetTilt = Math.max(-14, Math.min(14, dx * 0.55));
        d.tilt += (targetTilt - d.tilt) * 0.28;

        if (ghost) {
          ghost.style.transform = `translate3d(${d.curX.toFixed(1)}px, ${d.curY.toFixed(
            1
          )}px, 0) rotate(${d.tilt.toFixed(2)}deg) scale(1.08)`;
        }
        dragRafRef.current = window.requestAnimationFrame(tick);
      };
      dragRafRef.current = window.requestAnimationFrame(tick);
    };

    const cacheOpenDropCells = () => {
      const cells: typeof cachedCellsRef.current = [];
      if (boardGridRef.current) {
        const nodes = boardGridRef.current.querySelectorAll<HTMLElement>('[data-drop-row]');
        nodes.forEach((node) => {
          const r = Number(node.dataset.dropRow);
          const c = Number(node.dataset.dropCol);
          const rect = node.getBoundingClientRect();
          cells.push({
            row: r,
            col: c,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          });
        });
      }
      cachedCellsRef.current = cells;
    };

    const activateBoardDrag = (
      card: HandCard,
      pointerId: number,
      pointerType: string,
      clientX: number,
      clientY: number,
      originRect: { left: number; top: number; width: number; height: number }
    ) => {
      const ghostWidth = Math.min(Math.max(originRect.width, 96), 124);
      const ghostHeight = (ghostWidth * 7) / 5;
      const offsetX = ghostWidth * 0.5;
      const offsetY = ghostHeight * 0.5;
      const touchLiftY = pointerType === 'touch' ? 28 : 0;

      suppressHandClickUntilRef.current = Date.now() + 450;
      cacheOpenDropCells();

      dragPendingRef.current = {
        card,
        pointerId,
        pointerType,
        startX: clientX,
        startY: clientY,
        originLeft: originRect.left,
        originTop: originRect.top,
        width: ghostWidth,
        offsetX,
        offsetY,
        active: true,
        curX: originRect.left,
        curY: originRect.top,
        targetX: clientX - offsetX,
        targetY: clientY - offsetY - touchLiftY,
        tilt: 0,
      };

      onSelectHandUid(card.uid);
      setDraggingCard({
        card,
        width: ghostWidth,
        originLeft: originRect.left,
        originTop: originRect.top,
        returning: false,
      });
      sound.select();
      startPhysicsLoop();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const s = mobileScrubRef.current;
      if (s && e.pointerId === s.pointerId) {
        const moveDx = e.clientX - s.startX;
        const moveDy = e.clientY - s.startY;
        const dist = Math.hypot(moveDx, moveDy);

        if (s.mode === 'pending') {
          if (dist < 8) return;

          if (
            canPlayerPlayRef.current &&
            moveDy < -10 &&
            Math.abs(moveDy) >= Math.abs(moveDx) * 1.05
          ) {
            mobileScrubRef.current = null;
            if (s.pointerType === 'touch') e.preventDefault();
            activateBoardDrag(
              s.startCard,
              e.pointerId,
              s.pointerType,
              e.clientX,
              e.clientY,
              s.startRect
            );
            return;
          }

          s.mode = 'scrubbing';
          suppressHandClickUntilRef.current = Date.now() + 450;
        }

        if (s.pointerType === 'touch') {
          e.preventDefault();
        }

        if (canPlayerPlayRef.current && e.clientY < s.fanTop - 26) {
          const hand = playerHandRef.current;
          const activeCard = hand.find((c) => c.uid === s.activeUid) ?? s.startCard;
          const slotEl = mobileHandFanRef.current?.querySelector<HTMLElement>(
            `[data-hand-uid="${activeCard.uid}"]`
          );
          const slotRect = slotEl
            ? slotEl.getBoundingClientRect()
            : { left: e.clientX - 38, top: s.fanTop, width: 76, height: 106 };

          mobileScrubRef.current = null;
          scrubCardUidRef.current = null;
          setScrubCardUid(null);
          activateBoardDrag(
            activeCard,
            e.pointerId,
            s.pointerType,
            e.clientX,
            e.clientY,
            slotRect
          );
          return;
        }

        const hand = playerHandRef.current;
        if (hand.length > 0) {
          const span = Math.max(1, s.fanRight - s.fanLeft);
          const t = Math.max(0, Math.min(0.999, (e.clientX - s.fanLeft) / span));
          const idx = Math.floor(t * hand.length);
          const targetCard = hand[idx];

          if (targetCard && scrubCardUidRef.current !== targetCard.uid) {
            s.activeUid = targetCard.uid;
            scrubCardUidRef.current = targetCard.uid;
            setScrubCardUid(targetCard.uid);
            onSelectHandUid(targetCard.uid);
            sound.hover();
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(8);
            }
          }
        }
        return;
      }

      const d = dragPendingRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      const moveDx = e.clientX - d.startX;
      const moveDy = e.clientY - d.startY;
      const dist = Math.hypot(moveDx, moveDy);

      if (!d.active) {
        const threshold = d.pointerType === 'touch' ? 11 : 6;
        if (dist < threshold) return;

        d.active = true;
        suppressHandClickUntilRef.current = Date.now() + 450;
        cacheOpenDropCells();

        const touchLiftY = d.pointerType === 'touch' ? 28 : 0;
        d.curX = d.originLeft;
        d.curY = d.originTop;
        d.targetX = e.clientX - d.offsetX;
        d.targetY = e.clientY - d.offsetY - touchLiftY;
        d.tilt = 0;

        onSelectHandUid(d.card.uid);
        setDraggingCard({
          card: d.card,
          width: d.width,
          originLeft: d.originLeft,
          originTop: d.originTop,
          returning: false,
        });
        sound.select();
        startPhysicsLoop();
      }

      if (d.pointerType === 'touch') {
        e.preventDefault();
      }

      const touchLiftY = d.pointerType === 'touch' ? 28 : 0;
      d.targetX = e.clientX - d.offsetX;
      d.targetY = e.clientY - d.offsetY - touchLiftY;

      const hitY = e.clientY - (d.pointerType === 'touch' ? 18 : 0);
      let matched: { row: number; col: number } | null = null;
      for (const rect of cachedCellsRef.current) {
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          hitY >= rect.top &&
          hitY <= rect.bottom
        ) {
          matched = { row: rect.row, col: rect.col };
          break;
        }
      }

      const prev = hoverCellRef.current;
      if (prev?.row !== matched?.row || prev?.col !== matched?.col) {
        hoverCellRef.current = matched;
        setHoverCell(matched);
        if (matched) {
          sound.hover();
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const s = mobileScrubRef.current;
      if (s && e.pointerId === s.pointerId) {
        if (s.mode === 'scrubbing') {
          suppressHandClickUntilRef.current = Date.now() + 300;
        }
        mobileScrubRef.current = null;
        scrubCardUidRef.current = null;
        setScrubCardUid(null);
        return;
      }

      const d = dragPendingRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      const wasActive = d.active;
      const dropTarget = hoverCellRef.current;
      const draggedCard = d.card;
      const originLeft = d.originLeft;
      const originTop = d.originTop;
      const width = d.width;

      dragPendingRef.current = null;
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (!wasActive) return;

      suppressHandClickUntilRef.current = Date.now() + 350;
      hoverCellRef.current = null;
      setHoverCell(null);

      if (dropTarget) {
        const cell = board[dropTarget.row]?.[dropTarget.col];
        if (cell && !cell.blocked && !cell.card) {
          setDraggingCard(null);
          onExecutePlayerMove(draggedCard.uid, dropTarget.row, dropTarget.col);
          return;
        }
      }

      onSelectHandUid(null);
      setDraggingCard({
        card: draggedCard,
        width,
        originLeft,
        originTop,
        returning: true,
      });

      window.requestAnimationFrame(() => {
        if (dragGhostRef.current) {
          dragGhostRef.current.style.transition =
            'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';
          dragGhostRef.current.style.transform = `translate3d(${originLeft}px, ${originTop}px, 0) rotate(0deg) scale(1)`;
          dragGhostRef.current.style.opacity = '0.88';
        }
      });

      const clearTimer = window.setTimeout(() => {
        setDraggingCard((cur) => (cur?.returning ? null : cur));
      }, 225);
      timersRef.current.push(clearTimer);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, [board, onExecutePlayerMove, onSelectHandUid, timersRef]);

  const handleMobileFanPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    hCard: HandCard
  ) => {
    if (phase !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cardRect = e.currentTarget.getBoundingClientRect();
    const fanRect = mobileHandFanRef.current?.getBoundingClientRect() ?? cardRect;

    mobileScrubRef.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      startCard: hCard,
      startRect: {
        left: cardRect.left,
        top: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
      },
      fanLeft: fanRect.left,
      fanRight: fanRect.right,
      fanTop: fanRect.top,
      mode: 'pending',
      activeUid: hCard.uid,
    };
  };

  const handleHandCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    hCard: HandCard
  ) => {
    if (phase !== 'playing' || turn !== 'player' || isAnimating) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ghostWidth = Math.min(Math.max(rect.width, 96), 124);
    const scaleOffsetX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * ghostWidth;
    const ghostHeight = (ghostWidth * 7) / 5;
    const scaleOffsetY = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * ghostHeight;

    dragPendingRef.current = {
      card: hCard,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: ghostWidth,
      offsetX: scaleOffsetX,
      offsetY: scaleOffsetY,
      active: false,
      curX: rect.left,
      curY: rect.top,
      targetX: rect.left,
      targetY: rect.top,
      tilt: 0,
    };
  };

  const clearHoverCell = () => {
    hoverCellRef.current = null;
    setHoverCell(null);
  };

  const getInitialGhostPos = () => {
    const d = dragPendingRef.current;
    return d
      ? { x: d.curX, y: d.curY }
      : draggingCard
      ? { x: draggingCard.originLeft, y: draggingCard.originTop }
      : { x: 0, y: 0 };
  };

  return {
    draggingCard,
    hoverCell,
    setHoverCell,
    clearHoverCell,
    scrubCardUid,
    boardGridRef,
    mobileHandFanRef,
    dragGhostRef,
    suppressHandClickUntilRef,
    handleMobileFanPointerDown,
    handleHandCardPointerDown,
    getInitialGhostPos,
  };
}
