import { ReactElement, useCallback } from 'react';
import { WorldPoint } from '../types/World';
import { useMappedValueWithCallbacks } from '../../../hooks/useMappedValueWithCallbacks';
import { Config, LayoutConfig, RenderConfig } from '../types/Config';
import { useMappedValuesWithCallbacks } from '../../../hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../RenderGuardedComponent';
import { useReactManagedValueAsValueWithCallbacks } from '../../../hooks/useReactManagedValueAsValueWithCallbacks';

export type ArrowAnchor = {
  /**
   * The location of the tail/head of the arrow.
   */
  pos: WorldPoint;
  /**
   * Which direction the arrow exit the point going
   * in (for the tail) or enter the point going in
   * (for the head)
   *
   * up/right/down/left
   */
  dir: 0 | 1 | 2 | 3;
};

export type ArrowProps = {
  /**
   * Where the arrow starts, not accounting for the tail to anchor spacing
   */
  from: ArrowAnchor;
  /**
   * Where the arrow ends, not accounting for the head to anchor spacing
   */
  to: ArrowAnchor;
  /**
   * The distance the arrow moves in the from direction
   * before switching to the cross axis
   */
  midpoint: number;
};

type ArrowPositionConfig = Pick<
  RenderConfig,
  'arrowItemGap' | 'arrowHeadLength' | 'arrowHeadAngleDeg'
> &
  LayoutConfig;

const arrowPosCfgEqualFn = (a: ArrowPositionConfig, b: ArrowPositionConfig): boolean => {
  return (
    a.arrowItemGap.tail === b.arrowItemGap.tail &&
    a.arrowItemGap.head === b.arrowItemGap.head &&
    a.arrowHeadLength === b.arrowHeadLength &&
    a.arrowHeadAngleDeg === b.arrowHeadAngleDeg
  );
};

type ArrowRenderConfig = Pick<RenderConfig, 'lineThickness' | 'color'>;

const arrowRenderCfgEqualFn = (a: ArrowRenderConfig, b: ArrowRenderConfig): boolean => {
  return a.lineThickness === b.lineThickness && a.color.every((v, i) => v === b.color[i]);
};

/**
 * Draws an arrow which only moves cardinally and has one bend
 * in it. The only configurable property is how long to continue
 * in the first direction before switching to the cross axis.
 */
export const Arrow = ({
  cfg: cfgRaw,
  props: propsRaw,
}: {
  cfg: Config;
  props: ArrowProps;
}): ReactElement => {
  // currently we only call this with react managed values, but I wrote it
  // with VWC in mind
  const cfg = useReactManagedValueAsValueWithCallbacks(cfgRaw);
  const props = useReactManagedValueAsValueWithCallbacks(propsRaw);
  const arrowPosCfg = useMappedValueWithCallbacks(
    cfg,
    (cfg): ArrowPositionConfig => ({
      arrowItemGap: cfg.render.arrowItemGap,
      arrowHeadLength: cfg.render.arrowHeadLength,
      arrowHeadAngleDeg: cfg.render.arrowHeadAngleDeg,
      columnGap: cfg.layout.columnGap,
      rowGap: cfg.layout.rowGap,
      undershootMidpointsBy: cfg.layout.undershootMidpointsBy,
    }),
    {
      outputEqualityFn: arrowPosCfgEqualFn,
    }
  );
  const lineProps = useMappedValuesWithCallbacks(
    [arrowPosCfg, props],
    useCallback(() => computeLines(arrowPosCfg.get(), props.get()), [arrowPosCfg, props])
  );
  const renderCfg = useMappedValueWithCallbacks(
    cfg,
    (cfg): ArrowRenderConfig => ({
      lineThickness: cfg.render.lineThickness,
      color: cfg.render.color,
    }),
    {
      outputEqualityFn: arrowRenderCfgEqualFn,
    }
  );

  const linesSvgProps = useMappedValuesWithCallbacks(
    [lineProps, renderCfg],
    useCallback(
      () => ({
        lines: lineProps.get(),
        cfg: renderCfg.get(),
      }),
      [lineProps, renderCfg]
    )
  );

  return (
    <RenderGuardedComponent
      props={linesSvgProps}
      component={(p) => (
        <LinesSvg
          {...p}
          debugAttrs={{
            'data-midpoint': props.get().midpoint.toString(),
          }}
        />
      )}
    />
  );
};

type LinesSvgProps = {
  lines: LineProps[];
  cfg: ArrowRenderConfig;
  debugAttrs?: Record<string, string>;
};

const LinesSvg = ({ lines, cfg, debugAttrs }: LinesSvgProps): ReactElement => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let line of lines) {
    for (let pt of line.points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  if (!isFinite(minX)) {
    return <></>;
  }

  minX -= cfg.lineThickness / 2;
  minY -= cfg.lineThickness / 2;
  maxX += cfg.lineThickness / 2;
  maxY += cfg.lineThickness / 2;

  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${minX}px`,
        top: `${minY}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...debugAttrs}>
      <svg
        width={width}
        height={height}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg">
        {lines.map((line, i) => (
          <path
            key={i}
            d={makeLinePath(line.points)}
            strokeWidth={makeSVGNumber(cfg.lineThickness)}
            strokeLinecap="round"
            strokeMiterlimit={10}
            stroke={colorToCSS(cfg.color)}
          />
        ))}
      </svg>
    </div>
  );
};

const makeSVGNumber = (v: number): string => {
  return `${Number(v.toFixed(3))}`;
};

const makeLinePath = (data: WorldPoint[]): string => {
  const parts: string[] = [];
  for (let i = 1; i < data.length; i++) {
    parts.push(
      `M${makeSVGNumber(data[i - 1].x)} ${makeSVGNumber(data[i - 1].y)}`,
      `L${makeSVGNumber(data[i].x)} ${makeSVGNumber(data[i].y)}`
    );
  }
  return parts.join('');
};

const colorFloatToByte = (color: number): number => {
  return Math.max(0, Math.min(255, Math.round(color * 255)));
};

const colorToCSS = (color: [number, number, number, number]) => {
  return `rgba(${colorFloatToByte(color[0])}, ${colorFloatToByte(color[1])}, ${colorFloatToByte(
    color[2]
  )}, ${color[3]})`;
};

type LineProps = {
  /**
   * The line is drawn by starting at the first point, continuing to the
   * second point, then, continuing to the third point, etc.
   */
  points: WorldPoint[];
};

/**
 * Determines where lines should be drawn for the arrow
 * @param props The arrow properties
 */
const computeLines = (cfg: ArrowPositionConfig, props: ArrowProps): LineProps[] => {
  const headMajorAxisLength =
    Math.cos(cfg.arrowHeadAngleDeg * (Math.PI / 180)) * cfg.arrowHeadLength;
  const headMinorAxisLength =
    Math.sin(cfg.arrowHeadAngleDeg * (Math.PI / 180)) * cfg.arrowHeadLength;
  const headTip = addVec(props.to.pos, scaleVec(dirToUnitVec[props.to.dir], cfg.arrowItemGap.head));

  const realFrom = addVec(props.from.pos, {
    [dirToAxis[props.from.dir]]: 0,
    [otherAxis[dirToAxis[props.from.dir]]]:
      Math.sign(
        props.to.pos[otherAxis[dirToAxis[props.from.dir]]] -
          props.from.pos[otherAxis[dirToAxis[props.from.dir]]]
      ) * cfg.undershootMidpointsBy,
  } as WorldPoint);

  const midpointTurnFromSrcAt = addVec(
    realFrom,
    scaleVec(dirToUnitVec[props.from.dir], props.midpoint - cfg.undershootMidpointsBy)
  );

  if (
    Math.abs(
      headTip[dirToAxis[props.from.dir]] - midpointTurnFromSrcAt[dirToAxis[props.from.dir]]
    ) <=
    cfg.undershootMidpointsBy + 0.1
  ) {
    headTip[dirToAxis[props.from.dir]] = midpointTurnFromSrcAt[dirToAxis[props.from.dir]];
  }

  return [
    {
      points: [
        addVec(realFrom, scaleVec(dirToUnitVec[props.from.dir], cfg.arrowItemGap.tail)),
        midpointTurnFromSrcAt,
        matchAxis(
          addVec(
            props.to.pos,
            scaleVec(
              dirToUnitVec[props.to.dir],
              cfg[gapGoingIn[dirToAxis[props.to.dir]]] / 2 - cfg.undershootMidpointsBy
            )
          ),
          midpointTurnFromSrcAt,
          otherAxis[dirToAxis[props.from.dir]]
        ),
        matchAxis(
          addVec(
            props.to.pos,
            scaleVec(
              dirToUnitVec[props.to.dir],
              cfg[gapGoingIn[dirToAxis[props.to.dir]]] / 2 - cfg.undershootMidpointsBy
            )
          ),
          headTip,
          dirToAxis[props.to.dir]
        ),
        headTip,
      ],
    },
    {
      points: [
        addVec(
          headTip,
          addVec(
            scaleVec(dirToUnitVec[props.to.dir], headMajorAxisLength),
            scaleVec(dirToUnitVec[((props.to.dir + 1) % 4) as 0 | 1 | 2 | 3], headMinorAxisLength)
          )
        ),
        headTip,
        addVec(
          headTip,
          addVec(
            scaleVec(dirToUnitVec[props.to.dir], headMajorAxisLength),
            scaleVec(dirToUnitVec[((props.to.dir + 3) % 4) as 0 | 1 | 2 | 3], headMinorAxisLength)
          )
        ),
      ],
    },
  ];
};

const dirToUnitVec = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
} as const;
const dirToAxis = { 0: 'y', 1: 'x', 2: 'y', 3: 'x' } as Record<0 | 1 | 2 | 3, 'x' | 'y'>;
const gapGoingIn = { x: 'columnGap', y: 'rowGap' } as const;
const otherAxis = { x: 'y', y: 'x' } as const;

const scaleVec = (vec: WorldPoint, scale: number): WorldPoint => {
  return {
    x: vec.x * scale,
    y: vec.y * scale,
  };
};

const addVec = (a: WorldPoint, b: WorldPoint): WorldPoint => {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
};

const matchAxis = (a: WorldPoint, b: WorldPoint, axisFromA: 'x' | 'y'): WorldPoint => {
  return {
    x: axisFromA === 'x' ? a.x : b.x,
    y: axisFromA === 'y' ? a.y : b.y,
  };
};
