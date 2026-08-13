interface DropdownPlacementInput {
  contentHeight: number;
  gap: number;
  triggerTop: number;
  triggerBottom: number;
  viewportTop: number;
  viewportBottom: number;
}

export function getDropdownPlacement({
  contentHeight,
  gap,
  triggerTop,
  triggerBottom,
  viewportTop,
  viewportBottom,
}: DropdownPlacementInput): 'top' | 'bottom' {
  const spaceBelow = viewportBottom - triggerBottom;
  const spaceAbove = triggerTop - viewportTop;
  const requiredSpace = contentHeight + gap;

  return spaceBelow < requiredSpace && spaceAbove > spaceBelow ? 'top' : 'bottom';
}
