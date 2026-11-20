import QRCode from "qrcode";
import { headers } from "next/headers";
import { requirePage } from "@/lib/auth";
import { appPort, computerName, firewallStatus, isLocalHost, lanAddresses, listDevices } from "@/lib/network";
import { PageHeader, Section } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ConnectionCheck, DeviceList } from "./device-tools";

export const metadata = { title: "Connect devices" };
export const dynamic = "force-dynamic";

export default async function ConnectDevicesPage() {
  const s = await requirePage("settings");
  const h = await headers();
  const onShopPc = isLocalHost(h.get("host"));
  const port = appPort();
  const addrs = lanAddresses();
  const pcName = computerName();
  const codes = await Promise.all(
    addrs.map(async (a) => {
      const url = `http://${a.address}:${port}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 196, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
      return { ...a, url, svg };
    }),
  );
  const firewall = await firewallStatus().catch(() => null);
  const now = Date.now();
  const devices = listDevices().map((d) => ({ ...d, ago: Math.round((now - d.lastSeen) / 1000) }));

  return (
    <>
      <PageHeader
        title="Connect devices"
        subtitle="Use Spoaxio Software on phones, tablets and other PCs in the shop – same Wi-Fi, no internet needed"
        back="/settings"
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Section title="1. Scan with the phone camera">
            {codes.length ? (
              <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                {codes.map((c) => (
                  <div key={c.address} className="flex flex-col items-center rounded-xl border border-gray-200 p-4 text-center">
                    <div className="rounded-lg bg-white p-1 ring-1 ring-gray-200" aria-label={`QR code for ${c.url}`} dangerouslySetInnerHTML={{ __html: c.svg }} />
                    <div className="mt-3 select-all whitespace-nowrap font-mono text-base font-semibold text-gray-950 sm:text-lg">{c.url}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {(() => {
                        const kind = c.kind === "wifi" ? "Wi-Fi" : c.kind === "ethernet" ? "Network cable" : c.name;
                        return kind.toLowerCase() === c.name.toLowerCase() ? kind : `${kind} · ${c.name}`;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-800">This PC is not connected to any Wi-Fi or network. Connect it to the shop Wi-Fi first.</p>
            )}
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
              <li>On the phone, <b>turn off mobile data</b> and connect to the <b>same Wi-Fi</b> as this PC.</li>
              <li>Open the camera and point it at the code (or type the address in Chrome / Safari exactly – <b>http</b>, not https).</li>
              <li>Log in with the staff member&apos;s own username.</li>
              <li>
                Keep it on the home screen: Chrome menu <b>⋮ → Add to Home screen</b>, or Safari <b>Share → Add to Home Screen</b>. It gets the app icon and
                opens straight to the login.
              </li>
            </ol>
          </Section>

          <Section title="2. Second counter PC (Windows)">
            <p className="text-sm text-gray-700">
              Nothing to install. On the other PC open Microsoft Edge and go to the address above – or download this shortcut, copy it to that PC&apos;s desktop
              and double-click it.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {codes.slice(0, 1).map((c) => (
                <a key={c.address} className="btn-outline" href={`/api/shortcut?addr=${encodeURIComponent(c.address)}`}>
                  <Icon name="inbox" className="h-4 w-4" />Download “Spoaxio Software” shortcut
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Other Windows PCs can usually also use <span className="font-mono">http://{pcName}:{port}</span> – that name keeps working even when the number
              changes.
            </p>
          </Section>

          <Section title="Not opening? Check these">
            <ul className="space-y-2 text-sm text-gray-700">
              <li><b>Same Wi-Fi:</b> the phone must be on the same Wi-Fi as this PC, with mobile data off.</li>
              <li><b>Exact address:</b> <span className="font-mono">http://</span>…<span className="font-mono">:{port}</span> – not https, not “localhost” (that means the phone itself).</li>
              <li><b>Windows Firewall:</b> the check on the right must be green.</li>
              <li>
                <b>Phone hotspot / “guest” or “IoT” Wi-Fi:</b> many of these stop devices from seeing each other (“client isolation”). If the phone sharing the
                hotspot can open it but other phones cannot, use a normal Wi-Fi router.
              </li>
              <li>
                <b>Address keeps changing:</b> in the Wi-Fi router&apos;s settings give this PC a fixed address (“DHCP reservation” / “address reservation”). No
                internet is needed for any of this.
              </li>
            </ul>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Connection check">
            <ConnectionCheck onShopPc={onShopPc} isOwner={s.role === "OWNER"} initial={firewall} />
          </Section>
          <Section title="Devices using Spoaxio Software" pad={false}>
            <DeviceList devices={devices} />
          </Section>
        </div>
      </div>
    </>
  );
}
