"use client";
import {
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  ReactNode,
} from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

export function Input(props: InputProps) {
  const { className = "", ref, ...rest } = props;
  return (
    <input
      ref={ref}
      className={`w-full py-3 px-3.5 rounded-xl text-base font-semibold outline-none border-[1.5px] border-border focus:border-orange text-navy ${className}`}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children?: ReactNode;
};

export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select
      className={`w-full py-3 px-3.5 rounded-xl text-[15px] outline-none border-[1.5px] border-border bg-white focus:border-orange ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
