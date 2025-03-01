import { _map } from "eez-studio-shared/algorithm";
import { formatNumber } from "eez-studio-shared/util";

export const TAB = "    ";

export { NamingConvention, getName } from "project-editor/project/assets";

export function dumpData(data: number[] | Buffer) {
    const NUMBERS_PER_LINE = 16;
    let result = "";
    _map(data, value => "0x" + formatNumber(value, 16, 2)).forEach(
        (value, index) => {
            if (result.length > 0) {
                result += ",";
            }
            if (index % NUMBERS_PER_LINE == 0) {
                result += "\n" + TAB;
            } else {
                result += " ";
            }
            result += value;
        }
    );
    result += "\n";
    return result;
}

export function indent(tab: string, text: string) {
    return text
        .split("\n")
        .map(line => tab + line)
        .join("\n");
}

export function escapeCString(text: string) {
    return `"${text
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r")}"`;
}

export class Build {
    result: string;
    indentation: string;

    startBuild() {
        this.result = "";
        this.indentation = "";
    }

    indent() {
        this.indentation += TAB;
    }

    unindent() {
        this.indentation = this.indentation.substring(
            0,
            this.indentation.length - TAB.length
        );
    }

    line(line: string) {
        this.result += this.indentation + line + "\n";
    }

    text(text: string) {
        this.result += text;
    }
}
