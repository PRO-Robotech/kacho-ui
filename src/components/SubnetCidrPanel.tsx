// SubnetCidrPanel — управление CIDR-блоками подсети в блоке «Обзор» detail-
// страницы (по аналогии с RoutesPanel/«Статические маршруты»). CIDR-блоки
// мутируются ОТДЕЛЬНЫМИ RPC (:add-cidr-blocks / :remove-cidr-blocks), а НЕ
// PATCH-ом ресурса — поэтому они здесь, а не в форме редактирования подсети.
import { Typography } from "antd";
import { SectionHeader } from "@/components/SectionHeader";
import { SubnetCidrManager } from "@/components/SubnetCidrManager";

interface Props {
  subnetId: string;
  v4Blocks: string[];
  v6Blocks: string[];
}

export function SubnetCidrPanel({ subnetId, v4Blocks, v6Blocks }: Props) {
  const count = v4Blocks.length + v6Blocks.length;
  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader
        eyebrow="Список"
        title={
          <span>
            CIDR-блоки <Typography.Text type="secondary">({count})</Typography.Text>
          </span>
        }
      />
      <SubnetCidrManager subnetId={subnetId} v4Blocks={v4Blocks} v6Blocks={v6Blocks} />
    </div>
  );
}
