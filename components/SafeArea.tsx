import type { CSSProperties, ReactNode } from 'react';

type SafeAreaProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
};

export default function SafeArea({
  children,
  className = '',
  style,
  as: Component = 'div'
}: SafeAreaProps) {
  const combinedClassName = ['safe-area', className].filter(Boolean).join(' ');
  return (
    <Component className={combinedClassName} style={style}>
      {children}
    </Component>
  );
}
