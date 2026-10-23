/**
 * Whose game this is.
 *
 * In its own file because it sits on the home screen, and the rules screen
 * it used to live beside is now fetched only when somebody opens it. One
 * line of credit is not a reason to download four screens of rules.
 */

import { useT } from '../../i18n/index.jsx';

export function Credit() {
  const { t } = useT();
  return (
    <p className="credit">
      {t('credit.madeBy')} <b>Thanate Amornjiraporn</b> <span>(Focus)</span>
    </p>
  );
}
