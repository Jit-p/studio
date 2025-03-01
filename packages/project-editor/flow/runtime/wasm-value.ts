import { Stream } from "stream";

import type {
    AssetsMap,
    IObjectVariableType,
    IObjectVariableValueFieldDescription,
    IWasmFlowRuntime,
    ValueType
} from "eez-studio-types";
import {
    FLOW_VALUE_TYPE_ARRAY,
    FLOW_VALUE_TYPE_ARRAY_ASSET,
    FLOW_VALUE_TYPE_ARRAY_REF,
    FLOW_VALUE_TYPE_BLOB_REF,
    FLOW_VALUE_TYPE_BOOLEAN,
    FLOW_VALUE_TYPE_DOUBLE,
    FLOW_VALUE_TYPE_FLOAT,
    FLOW_VALUE_TYPE_INT16,
    FLOW_VALUE_TYPE_INT32,
    FLOW_VALUE_TYPE_INT64,
    FLOW_VALUE_TYPE_INT8,
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_STREAM,
    FLOW_VALUE_TYPE_STRING,
    FLOW_VALUE_TYPE_STRING_ASSET,
    FLOW_VALUE_TYPE_STRING_REF,
    FLOW_VALUE_TYPE_UINT16,
    FLOW_VALUE_TYPE_UINT32,
    FLOW_VALUE_TYPE_UINT64,
    FLOW_VALUE_TYPE_UINT8,
    FLOW_VALUE_TYPE_UNDEFINED,
    FLOW_VALUE_TYPE_DATE,
    FLOW_VALUE_TYPE_POINTER
} from "project-editor/build/value-types";
import type {
    ObjectOrArrayValueWithType,
    Value,
    ValueWithType
} from "eez-studio-types";

type Values = (null | boolean | number | string | ArrayValue)[];

export type ArrayValue = {
    valueTypeIndex: number;
    values: Values;
};

export function createJsArrayValue(
    valueTypeIndex: number,
    value: any,
    assetsMap: AssetsMap,
    getObjectVariableTypeFromType:
        | ((type: string) => IObjectVariableType | undefined)
        | undefined
): ArrayValue {
    function createArrayValue(
        valueTypeIndex: number,
        value: any,
        valueFieldDescriptions:
            | IObjectVariableValueFieldDescription[]
            | undefined
    ): ArrayValue {
        const type = assetsMap.types[valueTypeIndex];

        let values;
        if (type.kind == "array") {
            values = value.map((elementValue: any) => {
                let fieldValueFieldDescriptions:
                    | IObjectVariableValueFieldDescription[]
                    | undefined;

                if (valueFieldDescriptions) {
                    const temp = valueFieldDescriptions[0];
                    if (typeof temp.valueType != "string") {
                        fieldValueFieldDescriptions = temp.valueType;
                    }
                }

                return createArrayValue(
                    assetsMap.typeIndexes[type.elementType.valueType],
                    elementValue,
                    fieldValueFieldDescriptions
                );
            });
        } else if (type.kind == "object") {
            if (value) {
                values = type.fields.map((field, i) => {
                    let fieldValue = valueFieldDescriptions
                        ? valueFieldDescriptions[i].getFieldValue(value)
                        : value[field.name];

                    const fieldValueTypeIndex =
                        assetsMap.typeIndexes[field.valueType];
                    if (fieldValueTypeIndex != undefined) {
                        let fieldValueFieldDescriptions:
                            | IObjectVariableValueFieldDescription[]
                            | undefined;

                        if (valueFieldDescriptions) {
                            const temp = valueFieldDescriptions[i];
                            if (typeof temp.valueType != "string") {
                                fieldValueFieldDescriptions = temp.valueType;
                            }
                        }

                        if (fieldValueFieldDescriptions) {
                            return createArrayValue(
                                fieldValueTypeIndex,
                                fieldValue,
                                fieldValueFieldDescriptions
                            );
                        } else {
                            const fieldType =
                                assetsMap.types[fieldValueTypeIndex];
                            if (fieldType.kind != "basic") {
                                return createArrayValue(
                                    fieldValueTypeIndex,
                                    fieldValue,
                                    undefined
                                );
                            } else {
                                if (typeof fieldValue == "string") {
                                    if (
                                        fieldType.valueType == "float" ||
                                        fieldType.valueType == "double"
                                    ) {
                                        fieldValue =
                                            Number.parseFloat(fieldValue);
                                    } else if (
                                        fieldType.valueType == "integer"
                                    ) {
                                        fieldValue =
                                            Number.parseInt(fieldValue);
                                    }
                                } else if (fieldValue instanceof Date) {
                                    if (fieldType.valueType == "string") {
                                        fieldValue = fieldValue.toISOString();
                                        fieldValue =
                                            fieldValue.substring(0, 10) +
                                            " " +
                                            fieldValue.substring(
                                                11,
                                                fieldValue.length - 1
                                            );
                                    }
                                }
                            }
                        }
                    }
                    return fieldValue;
                });
            } else {
                return value;
            }
        } else {
            return value;
        }

        return {
            valueTypeIndex,
            values
        };
    }

    let objectVariableType;
    if (getObjectVariableTypeFromType) {
        const type = assetsMap.types[valueTypeIndex];
        objectVariableType = getObjectVariableTypeFromType(type.valueType);
    }

    return createArrayValue(
        valueTypeIndex,
        value,
        objectVariableType?.valueFieldDescriptions
    );
}

export function createWasmArrayValue(
    WasmFlowRuntime: IWasmFlowRuntime,
    arrayValue: ArrayValue
) {
    const arraySize = arrayValue.values.length;
    const arrayValuePtr = WasmFlowRuntime._createArrayValue(
        arraySize,
        arrayValue.valueTypeIndex
    );
    for (let i = 0; i < arraySize; i++) {
        let value = arrayValue.values[i];

        let valuePtr;
        if (
            value === null ||
            value === undefined ||
            typeof value == "number" ||
            typeof value == "boolean" ||
            typeof value == "string" ||
            value instanceof Date
        ) {
            valuePtr = createWasmValue(WasmFlowRuntime, value);
        } else {
            const type = WasmFlowRuntime.assetsMap.types[value.valueTypeIndex];
            valuePtr =
                type.kind == "basic"
                    ? createWasmValue(WasmFlowRuntime, value)
                    : createWasmArrayValue(WasmFlowRuntime, value);
        }

        WasmFlowRuntime._arrayValueSetElementValue(arrayValuePtr, i, valuePtr);
        WasmFlowRuntime._valueFree(valuePtr);
    }
    return arrayValuePtr;
}

export function createWasmValue(
    WasmFlowRuntime: IWasmFlowRuntime,
    value: undefined | null | number | boolean | string | ArrayValue,
    valueTypeIndex?: number
) {
    if (value === undefined) {
        return WasmFlowRuntime._createUndefinedValue();
    }

    if (value === null) {
        return WasmFlowRuntime._createNullValue();
    }

    if (typeof value == "number") {
        if (
            Number.isInteger(value) &&
            value >= -2147483648 &&
            value <= 2147483647
        ) {
            return WasmFlowRuntime._createIntValue(value);
        }
        return WasmFlowRuntime._createDoubleValue(value);
    }

    if (typeof value == "boolean") {
        return WasmFlowRuntime._createBooleanValue(value ? 1 : 0);
    }

    if (typeof value == "string") {
        const stringPtr = WasmFlowRuntime.allocateUTF8(value);
        const valuePtr = WasmFlowRuntime._createStringValue(stringPtr);
        WasmFlowRuntime._free(stringPtr);
        return valuePtr;
    }

    if (value instanceof Stream) {
        return WasmFlowRuntime._createStreamValue(getStreamID(value));
    }

    if (value instanceof Date) {
        return WasmFlowRuntime._createDateValue(value.getTime());
    }

    if (value instanceof Buffer || value instanceof Uint8Array) {
        const bufferPtr = WasmFlowRuntime._malloc(value.length);
        WasmFlowRuntime.HEAPU8.set(value, bufferPtr);
        return WasmFlowRuntime._createBlobValue(bufferPtr, value.length);
    }

    if (valueTypeIndex != undefined) {
        const arrayValue = createJsArrayValue(
            valueTypeIndex,
            value,
            WasmFlowRuntime.assetsMap,
            undefined
        );
        return createWasmArrayValue(WasmFlowRuntime, arrayValue);
    }

    if (value.valueTypeIndex != undefined) {
        return createWasmArrayValue(WasmFlowRuntime, value);
    }

    console.error("unsupported WASM value");

    return WasmFlowRuntime._createNullValue();
}

////////////////////////////////////////////////////////////////////////////////

export function getValue(
    WasmFlowRuntime: IWasmFlowRuntime,
    offset: number
): ValueWithType {
    const type = WasmFlowRuntime.HEAPU8[offset];
    offset += 8;
    if (type == FLOW_VALUE_TYPE_UNDEFINED) {
        return { value: undefined, valueType: "undefined" };
    } else if (type == FLOW_VALUE_TYPE_NULL) {
        return { value: null, valueType: "null" };
    } else if (type == FLOW_VALUE_TYPE_BOOLEAN) {
        return {
            value: WasmFlowRuntime.HEAP32[offset >> 2] ? true : false,
            valueType: "boolean"
        };
    } else if (type == FLOW_VALUE_TYPE_INT8) {
        return { value: WasmFlowRuntime.HEAP8[offset], valueType: "integer" };
    } else if (type == FLOW_VALUE_TYPE_UINT8) {
        return { value: WasmFlowRuntime.HEAPU8[offset], valueType: "integer" };
    } else if (type == FLOW_VALUE_TYPE_INT16) {
        return {
            value: WasmFlowRuntime.HEAP16[offset >> 1],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_UINT16) {
        return {
            value: WasmFlowRuntime.HEAPU16[offset >> 1],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_INT32) {
        return {
            value: WasmFlowRuntime.HEAP32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_UINT32) {
        return {
            value: WasmFlowRuntime.HEAPU32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_INT64) {
        // TODO
        return {
            value: WasmFlowRuntime.HEAP32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_UINT64) {
        // TODO
        return {
            value: WasmFlowRuntime.HEAPU32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_FLOAT) {
        return {
            value: WasmFlowRuntime.HEAPF32[offset >> 2],
            valueType: "float"
        };
    } else if (type == FLOW_VALUE_TYPE_DOUBLE) {
        return {
            value: WasmFlowRuntime.HEAPF64[offset >> 3],
            valueType: "double"
        };
    } else if (type == FLOW_VALUE_TYPE_STRING) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return {
            value: WasmFlowRuntime.UTF8ToString(ptr),
            valueType: "string"
        };
    } else if (type == FLOW_VALUE_TYPE_STRING_ASSET) {
        const relptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return {
            value: WasmFlowRuntime.UTF8ToString(offset + relptr),
            valueType: "string"
        };
    } else if (type == FLOW_VALUE_TYPE_ARRAY) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return getArrayValue(WasmFlowRuntime, ptr);
    } else if (type == FLOW_VALUE_TYPE_ARRAY_ASSET) {
        const relptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return getArrayValue(WasmFlowRuntime, offset + relptr);
    } else if (type == FLOW_VALUE_TYPE_STRING_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = WasmFlowRuntime.HEAP32[(refPtr >> 2) + 2];
        return {
            value: WasmFlowRuntime.UTF8ToString(ptr),
            valueType: "string"
        };
    } else if (type == FLOW_VALUE_TYPE_ARRAY_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = refPtr + 8;
        return getArrayValue(WasmFlowRuntime, ptr);
    } else if (type == FLOW_VALUE_TYPE_BLOB_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = WasmFlowRuntime.HEAP32[(refPtr >> 2) + 2];
        const len = WasmFlowRuntime.HEAP32[(refPtr >> 2) + 3];
        const value = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            value[i] = WasmFlowRuntime.HEAP8[ptr + i];
        }
        return {
            value,
            valueType: "blob"
        };
    } else if (type == FLOW_VALUE_TYPE_STREAM) {
        return {
            value: getStreamFromID(WasmFlowRuntime.HEAPU32[offset >> 2]),
            valueType: "stream"
        };
    } else if (type == FLOW_VALUE_TYPE_DATE) {
        return {
            value: new Date(WasmFlowRuntime.HEAPF64[offset >> 3]),
            valueType: "date"
        };
    } else if (type == FLOW_VALUE_TYPE_POINTER) {
        // TODO
        return {
            value: WasmFlowRuntime.HEAPU32[offset >> 2],
            valueType: "integer"
        };
    }

    console.error("Unknown type from WASM: ", type);
    return { value: undefined, valueType: "undefined" };
}

export function getArrayValue(
    WasmFlowRuntime: IWasmFlowRuntime,
    offset: number,
    expectedTypes?: ValueType[]
): ObjectOrArrayValueWithType {
    const arraySize = WasmFlowRuntime.HEAPU32[offset >> 2];
    const arrayType = WasmFlowRuntime.HEAPU32[(offset >> 2) + 1];

    const type = WasmFlowRuntime.assetsMap.types[arrayType];
    if (type.kind == "basic" || type.kind == "array") {
        if (
            expectedTypes &&
            !expectedTypes.find(valueType => valueType.startsWith("array:"))
        ) {
            return {
                value: undefined,
                valueType: "undefined" as ValueType
            };
        }

        const value: Value[] = [];
        for (let i = 0; i < arraySize; i++) {
            value.push(getValue(WasmFlowRuntime, offset + 8 + i * 16).value);
        }
        return {
            value,
            valueType: `array:${
                type.kind == "basic"
                    ? type.valueType
                    : type.elementType.valueType
            }` as ValueType
        };
    } else {
        if (expectedTypes && expectedTypes.indexOf(type.valueType) == -1) {
            return {
                value: undefined,
                valueType: "undefined" as ValueType
            };
        }

        const value: { [fieldName: string]: Value } = {};

        for (let i = 0; i < type.fields.length; i++) {
            if (i >= arraySize) {
                console.error("Invalid array value size");
                break;
            }
            const field = type.fields[i];
            value[field.name] = getValue(
                WasmFlowRuntime,
                offset + 8 + i * 16
            ).value;
        }

        return {
            value,
            valueType: type.valueType
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

const streams: Stream[] = [];
const streamIDs = new Map<Stream, number>();

function getStreamID(stream: Stream) {
    let streamID = streamIDs.get(stream);
    if (streamID == undefined) {
        streamID = streams.length;
        streams.push(stream);
        streamIDs.set(stream, streamID);
    }
    return streamID;
}

function getStreamFromID(streamID: number) {
    return streams[streamID];
}

export function clarStremIDs() {
    streamIDs.clear();
}
