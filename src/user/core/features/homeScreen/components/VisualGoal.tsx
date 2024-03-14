import { ReactElement } from 'react';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { makeSVGNumber as svgn } from '../../../../../shared/anim/svgUtils';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';

export type VisualGoalState = {
  /**
   * How many pills are filled, from 0 up to the goal.
   * Fractional values are allowed, and will result in
   * a partially filled pill.
   */
  filled: number;

  /**
   * The number of pills to show.
   */
  goal: number;
};

const ANGLE_PROPORTIONS_BY_GOAL: number[][] = [
  [],
  [1],
  [1, 1],
  [0.7, 1, 0.7],
  [0.8, 1, 1, 0.8],
  [0.9, 1, 1.2, 1, 0.9],
  [1, 1, 1, 1, 1, 1],
  [0.9, 1, 1, 1.2, 1.1, 1, 0.9],
];

type PathInfo = {
  startAngleDegrees: number;
  start: { x: number; y: number };
  endAngleDegrees: number;
  end: { x: number; y: number };
  largeArcFlag: number;
  sweepFlag: number;
};

const cutPath = (
  path: PathInfo,
  radius: number,
  cx: number,
  cy: number,
  progress: number
): [PathInfo, PathInfo] => {
  const cutAngle =
    path.startAngleDegrees +
    getAngleDistanceCW(path.startAngleDegrees, path.endAngleDegrees) * progress;
  const cutPosition = {
    x: cx + radius * Math.cos((cutAngle * Math.PI) / 180),
    y: cy + radius * Math.sin((cutAngle * Math.PI) / 180),
  };
  return [
    {
      ...path,
      endAngleDegrees: cutAngle,
      end: cutPosition,
      largeArcFlag: getAngleDistanceCW(path.startAngleDegrees, cutAngle) > 180 ? 1 : 0,
    },
    {
      ...path,
      startAngleDegrees: cutAngle,
      start: cutPosition,
      largeArcFlag: getAngleDistanceCW(cutAngle, path.endAngleDegrees) > 180 ? 1 : 0,
    },
  ];
};

/**
 * Renders a visual representation of the users progress towards
 * their weekly goal. This is a large number surrounding by a
 * partial circle cut into segments, each segment representing one
 * day of their goal.
 */
export const VisualGoal = ({ state: stateVWC }: { state: ValueWithCallbacks<VisualGoalState> }) => {
  const radius = 45;
  const strokeWidth = 6;
  const viewBox = {
    w: radius * 2 + strokeWidth + 2,
    h: radius * 2 + strokeWidth + 2,
  };
  const cx = viewBox.w / 2;
  const cy = viewBox.h / 2;

  const filledColor = '#EAEAEB';
  const filledOpacity = '1';
  const unfilledColor = '#FFFFFF';
  const unfilledOpacity = '0.35';

  const goalVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.goal);
  const pathInfoVWC = useMappedValueWithCallbacks(goalVWC, (goal) => {
    const cutAngleDegrees = 70;
    const spacerAngleDegrees = 2;
    const remainingAngleDegrees = 360 - cutAngleDegrees - (goal - 1) * spacerAngleDegrees;
    const partAngleDegrees = remainingAngleDegrees / goal;

    const angleProportions = ANGLE_PROPORTIONS_BY_GOAL[goal];
    const angleProportionsSum = angleProportions.reduce((a, b) => a + b, 0);
    const angleByPartIdx = angleProportions.map(
      (p) => (p / angleProportionsSum) * partAngleDegrees * goal
    );

    const paths: PathInfo[] = [];
    let nextStartAngleCWFromBottom = cutAngleDegrees / 2;
    for (let idx = 0; idx < goal; idx++) {
      const startAngleCWFromBottom = nextStartAngleCWFromBottom;
      nextStartAngleCWFromBottom += angleByPartIdx[idx] + spacerAngleDegrees;
      const startAngleStd = (startAngleCWFromBottom + 90) % 360;

      const startPosition = {
        x: cx + radius * Math.cos((startAngleStd * Math.PI) / 180),
        y: cy + radius * Math.sin((startAngleStd * Math.PI) / 180),
      };
      const endAngleStd = (startAngleStd + angleByPartIdx[idx]) % 360;
      const endPosition = {
        x: cx + radius * Math.cos((endAngleStd * Math.PI) / 180),
        y: cy + radius * Math.sin((endAngleStd * Math.PI) / 180),
      };
      const largeArcFlag = getAngleDistanceCW(startAngleStd, endAngleStd) > 180 ? 1 : 0;
      const sweepFlag = 1;

      console.log(
        `idx: ${idx}, startAngleStd: ${startAngleStd}, endAngleStd: ${endAngleStd}, largeArcFlag: ${largeArcFlag}, sweepFlag: ${sweepFlag}` +
          `; getAngleDistance(startAngleStd, endAngleStd): ${getAngleDistanceCW(
            startAngleStd,
            endAngleStd
          )}`
      );

      paths.push({
        startAngleDegrees: startAngleStd,
        start: startPosition,
        endAngleDegrees: endAngleStd,
        end: endPosition,
        largeArcFlag,
        sweepFlag,
      });
    }
    return paths;
  });
  const filledVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.filled);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      width="64"
      height="64">
      <defs>
        <marker id="roundFilled" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
          <circle r="1" fill={filledColor} fillOpacity={filledOpacity} />
        </marker>
        <marker id="roundUnfilledStart" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
          <path
            d="M0.002 -1A1 1 0 0 0 0.002 1Z"
            fill={unfilledColor}
            fillOpacity={unfilledOpacity}
            stroke="none"
          />
        </marker>
        <marker id="roundUnfilledEnd" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
          <path
            d="M-0.002 1A1 1 0 0 0 -0.002 -1Z"
            fill={unfilledColor}
            fillOpacity={unfilledOpacity}
            stroke="none"
          />
        </marker>
      </defs>
      <RenderGuardedComponent
        props={useMappedValuesWithCallbacks(
          [pathInfoVWC, filledVWC],
          () => ({
            segments: pathInfoVWC.get(),
            filled: Math.floor(filledVWC.get()),
            skipFilled: !Number.isInteger(filledVWC.get()),
          }),
          {
            outputEqualityFn: (a, b) =>
              Object.is(a.segments, b.segments) &&
              a.filled === b.filled &&
              a.skipFilled === b.skipFilled,
          }
        )}
        component={({ filled, segments, skipFilled }) => {
          const paths: ReactElement[] = [];
          for (let idx = 0; idx < segments.length; idx++) {
            if (skipFilled && idx === filled) {
              continue;
            }

            const segment = segments[idx];
            const isFilled = idx < filled;
            const marker = isFilled
              ? { start: 'url(#roundFilled)', end: 'url(#roundFilled)' }
              : {
                  start: 'url(#roundUnfilledStart)',
                  end: 'url(#roundUnfilledEnd)',
                };

            paths.push(
              <path
                d={`M${svgn(segment.start.x)} ${svgn(segment.start.y)} A${svgn(radius)} ${svgn(
                  radius
                )} 0 ${svgn(segment.largeArcFlag)} ${svgn(segment.sweepFlag)} ${svgn(
                  segment.end.x
                )} ${svgn(segment.end.y)}`}
                stroke={isFilled ? filledColor : unfilledColor}
                strokeOpacity={isFilled ? filledOpacity : unfilledOpacity}
                strokeWidth={svgn(strokeWidth)}
                fill="none"
                key={idx}
                markerStart={idx === 0 ? marker.start : undefined}
                markerEnd={idx === segments.length - 1 ? marker.end : undefined}
              />
            );
          }
          return <>{paths}</>;
        }}
      />
      <RenderGuardedComponent
        props={useMappedValuesWithCallbacks([pathInfoVWC, filledVWC], () => ({
          segments: pathInfoVWC.get(),
          index: Math.floor(filledVWC.get()),
          progress: filledVWC.get() - Math.floor(filledVWC.get()),
          required: !Number.isInteger(filledVWC.get()),
        }))}
        component={({ segments, index, progress, required }) => {
          if (!required) {
            return <></>;
          }
          const toDraw = cutPath(segments[index], radius, cx, cy, progress);
          const paths: ReactElement[] = [];
          for (let subidx = 0; subidx < toDraw.length; subidx++) {
            const isFilled = subidx === 0;

            const segment = toDraw[subidx];
            const marker = isFilled
              ? { start: 'url(#roundFilled)', end: 'url(#roundFilled)' }
              : {
                  start: 'url(#roundUnfilledStart)',
                  end: 'url(#roundUnfilledEnd)',
                };

            paths.push(
              <path
                d={`M${svgn(segment.start.x)} ${svgn(segment.start.y)} A${svgn(radius)} ${svgn(
                  radius
                )} 0 ${svgn(segment.largeArcFlag)} ${svgn(segment.sweepFlag)} ${svgn(
                  segment.end.x
                )} ${svgn(segment.end.y)}`}
                stroke={isFilled ? filledColor : unfilledColor}
                strokeOpacity={isFilled ? filledOpacity : unfilledOpacity}
                strokeWidth={svgn(strokeWidth)}
                fill="none"
                key={subidx}
                markerStart={index === 0 && subidx === 0 ? marker.start : undefined}
                markerEnd={
                  index === segments.length - 1 && subidx === toDraw.length - 1
                    ? marker.end
                    : undefined
                }
              />
            );
          }
          return <>{paths}</>;
        }}
      />
    </svg>
  );
};

const getAngleDistanceCW = (a: number, b: number) => {
  const normalizedA = (a + 360) % 360;
  const normalizedB = (b + 360) % 360;

  if (normalizedA < normalizedB) {
    return normalizedB - normalizedA;
  }
  return 360 - normalizedA + normalizedB;
};
