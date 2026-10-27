/*
 * Minimal React type declarations.
 *
 * The build environment for this project had no access to the npm registry, so
 * @types/react could not be installed. These declarations cover the React APIs
 * Perkora uses. If you install @types/react and @types/react-dom, delete this
 * file; the code is written against the standard React 19 API.
 */

declare namespace React {
  type Key = string | number | bigint;
  type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>
    | Promise<ReactNode>;
  interface ReactElement<P = any> {
    type: any;
    props: P;
    key: string | null;
  }
  type CSSProperties = Record<string, string | number | undefined>;
  type FC<P = {}> = (props: P) => ReactNode;
  type ComponentType<P = {}> = (props: P) => ReactNode;
  type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  interface RefObject<T> {
    current: T;
  }
  type Ref<T> = RefObject<T | null> | ((instance: T | null) => void) | null;
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prev: S) => S);
  interface SVGAttributes<T = any> {
    [key: string]: any;
  }
  interface HTMLAttributes<T = any> {
    [key: string]: any;
  }
  type FormEvent<T = any> = Event & { currentTarget: T; target: any; preventDefault(): void };
  type ChangeEvent<T = any> = Event & { currentTarget: T; target: T & { value: string; checked: boolean } };
  type KeyboardEvent<T = any> = globalThis.KeyboardEvent & { currentTarget: T };
  type MouseEvent<T = any> = globalThis.MouseEvent & { currentTarget: T };
  interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => ReactNode;
  }
}

declare module 'react' {
  export function useState<S>(initial: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initial: T): React.RefObject<T>;
  export function useRef<T>(initial: T | null): React.RefObject<T | null>;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps: readonly unknown[]): T;
  export function useId(): string;
  export function useTransition(): [boolean, (cb: () => void) => void];
  export function useContext<T>(ctx: React.Context<T>): T;
  export function createContext<T>(defaultValue: T): React.Context<T>;
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S): [S, React.Dispatch<A>];
  export const Fragment: (props: { children?: React.ReactNode; key?: React.Key }) => React.ReactNode;
  export const StrictMode: (props: { children?: React.ReactNode }) => React.ReactNode;
  export function createElement(type: any, props?: any, ...children: any[]): React.ReactElement;
  export function cloneElement(el: React.ReactElement, props?: any): React.ReactElement;
  export function isValidElement(v: unknown): v is React.ReactElement;
  export type ReactNode = React.ReactNode;
  export type ReactElement<P = any> = React.ReactElement<P>;
  export type FC<P = {}> = React.FC<P>;
  export type CSSProperties = React.CSSProperties;
  export type PropsWithChildren<P = {}> = React.PropsWithChildren<P>;
  export type ComponentType<P = {}> = React.ComponentType<P>;
  export type FormEvent<T = any> = React.FormEvent<T>;
  export type ChangeEvent<T = any> = React.ChangeEvent<T>;
  export type KeyboardEvent<T = any> = React.KeyboardEvent<T>;
  export type MouseEvent<T = any> = React.MouseEvent<T>;
  export type RefObject<T> = React.RefObject<T>;
  export interface SVGAttributes<T = any> {
    [key: string]: any;
  }
  export interface HTMLAttributes<T = any> {
    [key: string]: any;
  }
  export namespace JSX {
    type Element = React.ReactElement;
  }
}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    type Element = React.ReactElement;
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes {
      key?: React.Key | null;
    }
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    type ElementType = any;
  }
  export function jsx(type: any, props: any, key?: any): React.ReactElement;
  export function jsxs(type: any, props: any, key?: any): React.ReactElement;
  export const Fragment: any;
}

declare module 'react/jsx-dev-runtime' {
  export * from 'react/jsx-runtime';
}

declare module 'react-dom/server' {
  export function renderToString(el: React.ReactNode): string;
  export function renderToStaticMarkup(el: React.ReactNode): string;
}

declare module 'react-dom/client' {
  export interface Root {
    render(el: React.ReactNode): void;
    unmount(): void;
  }
  export function hydrateRoot(container: Element, el: React.ReactNode, options?: any): Root;
  export function createRoot(container: Element, options?: any): Root;
}

declare module 'react-dom' {
  export function createPortal(children: React.ReactNode, container: Element): React.ReactNode;
  export function flushSync<R>(fn: () => R): R;
}

declare namespace JSX {
  type Element = React.ReactElement;
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
