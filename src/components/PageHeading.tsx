import type { ReactNode } from 'react';
import { t } from '../i18n';

export function PageHeading({eyebrow,title,description,actions,className=''}:{eyebrow:string;title:string;description:string;actions?:ReactNode;className?:string}) {
  return <header className={`page-heading ${className}`}><div><p className="eyebrow">{t(eyebrow)}</p><h1>{t(title)}</h1><p className="page-description">{t(description)}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</header>;
}
