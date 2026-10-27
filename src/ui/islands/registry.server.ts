/** Island components available to the server renderer. Keep in sync with src/client/entry.tsx. */
import MobileNav from './MobileNav';
import WalletLive from './WalletLive';
import MemberQr from './MemberQr';
import CopyField from './CopyField';
import StaffTerminal from './StaffTerminal';
import SidebarToggle from './SidebarToggle';
import RewardPreview from './RewardPreview';
import PrintButton from './PrintButton';
import ShowWhen from './ShowWhen';

export const islandComponents: Record<string, (props: any) => any> = {
  MobileNav,
  WalletLive,
  MemberQr,
  CopyField,
  StaffTerminal,
  SidebarToggle,
  RewardPreview,
  PrintButton,
  ShowWhen,
};
