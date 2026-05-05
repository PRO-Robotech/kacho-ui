// Схема формы — описывает поля для resource Create/Edit dialogue.
// Используется ResourceForm для рендеринга нативных полей вместо JSON-textarea.

export type FormField =
  | StringField
  | TextField
  | IntField
  | EnumField
  | RefField
  | ArrayField
  | BoolField
  | SgRulesField;

interface BaseField {
  name: string; // dotted-path: "metadata.name", "spec.rules[0].direction"
  label: string;
  description?: string;
  required?: boolean;
  // Hidden — поле формы не показывается, но входит в payload (например metadata.folderId fills из контекста)
  hidden?: boolean;
  // Immutable after Create — в Edit-режиме поле рендерится disabled и
  // не попадает в update_mask. Backend всё равно бы отказал (см.
  // applySubnetMask `v4_cidr_blocks is immutable after Subnet.Create`),
  // но UI ловит это раньше + сразу подсказывает пользователю.
  immutable?: boolean;
}

export interface StringField extends BaseField {
  type: "string";
  placeholder?: string;
  default?: string;
  pattern?: string;
}

export interface TextField extends BaseField {
  type: "text";
  placeholder?: string;
  rows?: number;
}

export interface IntField extends BaseField {
  type: "int";
  min?: number;
  max?: number;
  default?: number;
}

export interface EnumField extends BaseField {
  type: "enum";
  options: { value: string; label: string }[];
  default?: string;
}

export interface BoolField extends BaseField {
  type: "bool";
  default?: boolean;
}

export interface RefField extends BaseField {
  type: "ref";
  // ID ресурса в registry откуда тянуть варианты
  refResource: string;
  // Если true — фильтруем по выбранному folder (selector field=folder_id op=EQ values=[currentFolder])
  refFolderScoped?: boolean;
  placeholder?: string;
}

export interface ArrayField extends BaseField {
  type: "array";
  itemFields: FormField[]; // sub-fields для одного элемента (paths внутри элемента, без префикса родителя)
  itemLabel: string; // как назвать «одну единицу»: "Rule", "Listener"
  // Минимум элементов (если 0 — массив можно опустить)
  minItems?: number;
  // Default для нового элемента
  newItem?: () => Record<string, unknown>;
}

// Специализированный editor для VPC SecurityGroup rules — слишком много conditional
// (oneof target, opt-in protocol/ports), generic ArrayField это не выражает.
// Render через SgRulesEditor; sanitize вычищает `_*` дискриминаторы при submit.
export interface SgRulesField extends BaseField {
  type: "sg-rules";
}
