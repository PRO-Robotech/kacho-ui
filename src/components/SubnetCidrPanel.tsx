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

const familyTile = (text: string) => (
  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "ui-monospace, monospace", letterSpacing: "-0.02em" }}>
    {text}
  </span>
);

export function SubnetCidrPanel({ subnetId, v4Blocks, v6Blocks }: Props) {
  return (
    <>
      <div style={{ marginTop: 24 }}>
        <SectionHeader
          icon={familyTile("v4")}
          eyebrow="Список"
          title={
            <span>
              IPv4 CIDR <Typography.Text type="secondary">({v4Blocks.length})</Typography.Text>
            </span>
          }
        />
        <CidrSection subnetId={subnetId} kind="v4" blocks={v4Blocks} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionHeader
          icon={familyTile("v6")}
          eyebrow="Список"
          title={
            <span>
              IPv6 CIDR <Typography.Text type="secondary">({v6Blocks.length})</Typography.Text>
            </span>
          }
        />
        <CidrSection subnetId={subnetId} kind="v6" blocks={v6Blocks} />
      </div>
    </>
  );
}
