import Image from "next/image";
import logo from "../../public/brand/logo.png";
import logoDark from "../../public/brand/logo-dark.png";

/** The VB Elite wordmark, swapping to the white version on dark backgrounds. */
export function Logo({ height, priority = false }: { height: number; priority?: boolean }) {
  const width = Math.round((height * logo.width) / logo.height);
  return (
    <>
      <Image src={logo} alt="VB Elite" height={height} width={width} priority={priority} className="logo-light" />
      <Image src={logoDark} alt="VB Elite" height={height} width={width} priority={priority} className="logo-dark" />
    </>
  );
}
