import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { SiteMenu } from "./SiteMenu";
import styles from "./ArchiveHeader.module.css";

export async function ArchiveHeader() {
  const cookieStore = await cookies();
  const consent = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value);

  return (
    <header className={`topbar ${styles.header}`}>
      <Link
        className={`brand-link ${styles.brand}`}
        href="/app"
        prefetch={false}
        aria-label="Descomplica, início"
      >
        <Image
          className={styles.brandMark}
          src="/descomplica-symbol.png"
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          loading="eager"
        />
        <span className={styles.brandName} aria-hidden="true">
          escomplica
        </span>
      </Link>
      <SiteMenu canPersistTheme={consent?.categories.functional === true} />
    </header>
  );
}
