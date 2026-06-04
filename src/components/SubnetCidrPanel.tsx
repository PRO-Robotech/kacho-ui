// SubnetCidrPanel — управление CIDR-блоками подсети в блоке «Обзор» detail-
// страницы. ДВЕ отдельные секции «IPv4 CIDR» / «IPv6 CIDR», у каждой своя
// иконка (v4 / v6) и табличный виджет (как «Статические маршруты»).
//
// CIDR-блоки мутируются ОТДЕЛЬНЫМИ RPC (:add-cidr-blocks / :remove-cidr-blocks),
// а НЕ PATCH-ом ресурса — поэтому они здесь, а не в форме редактирования.
import { Typography } from "antd";
import { SectionHeader } from "@/components/SectionHeader";
import { CidrSection } from "@/components/SubnetCidrManager";

interface Props {
  subnetId: string;
  v4Blocks: string[];
  v6Blocks: string[];
}

// Бейдж семейства — «IPv4» / «IPv6» в плитке (мелкий mono, чтобы поместилось).
const familyTile = (text: string) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "ui-monospace, monospace", letterSpacing: "-0.04em" }}>
    {text}
  </span>
);

export function SubnetCidrPanel({ subnetId, v4Blocks, v6Blocks }: Props) {
  return (
    <>
      <div style={{ marginTop: 24, maxWidth: 760 }}>
        <SectionHeader
          icon={familyTile("IPv4")}
          eyebrow="Список"
          title={
            <span>
              CIDR <Typography.Text type="secondary">({v4Blocks.length})</Typography.Text>
            </span>
          }
        />
        <CidrSection subnetId={subnetId} kind="v4" blocks={v4Blocks} />
      </div>

      <div style={{ marginTop: 24, maxWidth: 760 }}>
        <SectionHeader
          icon={familyTile("IPv6")}
          eyebrow="Список"
          title={
            <span>
              CIDR <Typography.Text type="secondary">({v6Blocks.length})</Typography.Text>
            </span>
          }
        />
        <CidrSection subnetId={subnetId} kind="v6" blocks={v6Blocks} />
      </div>
    </>
  );
}
