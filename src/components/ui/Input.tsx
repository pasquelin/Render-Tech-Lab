import { forwardRef, type InputHTMLAttributes } from 'react';
import { Field } from './Field.tsx';
type Props=InputHTMLAttributes<HTMLInputElement>&{label:string;help?:string;error?:string};
export const Input=forwardRef<HTMLInputElement,Props>(function Input({id,label,help,error,className='',...props},ref){const controlId=id??`input-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;return <Field id={controlId} label={label} help={help} error={error}><input ref={ref} id={controlId} className={`input input-bordered input-sm w-full bg-base-100 ${className}`} {...props}/></Field>;});
