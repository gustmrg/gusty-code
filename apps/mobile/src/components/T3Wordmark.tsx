import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 720 / 750;
  return (
    <Svg
      accessibilityLabel="Gusty"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="30 30 720 750"
    >
      <ThemedPath
        d="M475 48 C322 8 152 88 75 227 C6 352 44 493 147 543 C227 581 314 568 373 522 C270 543 184 462 181 359 C177 229 311 91 475 48Z M734 462 C745 338 657 201 552 162 C449 116 351 148 285 204 C217 258 198 367 249 446 C235 351 309 280 407 263 C546 236 672 323 734 462Z M349 769 C488 790 622 704 659 577 C692 465 638 372 572 329 C510 286 424 280 360 315 C462 309 537 396 548 483 C567 623 469 738 349 769Z M48 531 C74 642 163 710 285 703 C404 696 487 625 500 535 C510 481 498 441 469 403 C486 513 402 578 310 599 C217 623 110 589 48 531Z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
