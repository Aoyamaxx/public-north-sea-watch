declare module 'react-plotly.js' {
  import * as Plotly from 'plotly.js';
  import * as React from 'react';

  // Extended data types to support our custom chart types
  interface SankeyTrace {
    type: 'sankey';
    orientation?: string;
    node?: {
      pad?: number;
      thickness?: number;
      line?: {
        color?: string;
        width?: number;
      };
      label?: string[];
      color?: string[];
    };
    link?: {
      source: number[];
      target: number[];
      value: number[];
      color?: string[];
    };
  }

  interface ScatterTrace {
    x: number[];
    y: number[];
    type: 'scatter';
    mode?: string;
    marker?: {
      color?: string;
    };
    name?: string;
  }

  // Union type for all trace types we support
  type CustomData = SankeyTrace | ScatterTrace | Plotly.Data;

  interface PlotParams {
    data: CustomData[];
    layout?: Partial<Plotly.Layout>;
    frames?: Plotly.Frame[];
    config?: Partial<Plotly.Config>;
    onInitialized?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    divId?: string;
    className?: string;
    style?: React.CSSProperties;
    debug?: boolean;
    useResizeHandler?: boolean;
    onClick?: (data: any) => void;
    onBeforeHover?: (data: any) => void;
    onHover?: (data: any) => void;
    onUnhover?: (data: any) => void;
    onSelected?: (data: any) => void;
    onDeselect?: (data: any) => void;
    onDoubleClick?: (data: any) => void;
    onRelayout?: (data: any) => void;
    onRestyle?: (data: any) => void;
    onRedraw?: (data: any) => void;
    onAnimated?: (data: any) => void;
    onAddTrace?: (data: any) => void;
    onDeleteTrace?: (data: any) => void;
    onTransforming?: (data: any) => void;
    onTransformed?: (data: any) => void;
  }

  class Plot extends React.Component<PlotParams> {}
  export default Plot;
}
