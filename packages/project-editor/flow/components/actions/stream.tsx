import React from "react";
import { Duplex, Readable } from "stream";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

const regexpIcon: any = (
    <svg viewBox="0 0 1000 1000">
        <path d="M612.87 152.38c-12.07 13.03-49.63 80.67-62.09 111.72-6.71 16.48-7.28 19.93-7.47 36.41 0 17.44.38 19.16 7.09 32.77 16.48 33.34 52.31 53.46 84.51 47.52 26.83-4.79 49.82-22.23 62.09-47.33 6.71-13.22 7.28-15.71 7.28-30.85 0-20.89-4.79-35.83-22.04-69.94-16.67-32.96-43.12-76.84-49.25-81.63-6.89-5.38-14.17-4.81-20.12 1.33zm23 58.44c15.52 26.64 29.9 55.96 35.07 70.71 9.39 27.98-1.92 55.96-26.83 66.3-9 3.83-31.81 3.83-40.62.19-16.86-7.28-28.36-23.19-29.89-41.78-1.34-13.41 2.49-26.83 13.8-50.59 8.05-16.67 35.07-64.39 36.41-64.39.37.02 5.74 8.83 12.06 19.56zM370.08 343.05c-5.75 3.07-31.24 44.07-49.82 80.1-16.29 31.43-25.1 56.72-25.1 71.48 0 42.35 39.28 81.83 81.44 81.83s81.44-39.47 81.44-81.83c0-23.38-19.74-67.45-58.06-129.54-6.32-10.16-12.46-19.55-13.61-20.31-4.03-3.27-11.69-4.03-16.29-1.73zm18.4 61.89c24.14 40.63 38.9 74.93 38.9 90.83 0 21.84-13.61 41.39-32.77 46.95-38.52 11.5-71.48-13.22-68.22-51.36 1.34-17.05 20.7-58.83 45.03-97.73 5.37-8.81 4.98-9 17.06 11.31z" />
        <path d="M18.06 578.75c-8.24 3.83-10.73 15.52-4.79 22.8 3.64 4.6 4.6 4.6 43.5 5.56l39.86.96 77.23 119.77c42.54 65.92 78.76 120.92 80.48 122.07 4.79 3.64 486.93 3.64 491.72 0 1.73-1.15 37.94-56.15 80.48-122.07l77.23-119.77 39.48-.96c27.98-.77 40.05-1.72 42.35-3.45 7.28-6.13 5.17-21.08-3.64-25.1-7.67-3.45-88.92-2.88-93.9.57-2.11 1.53-38.71 56.72-81.25 122.64l-77.42 119.96H270.82l-77.23-119.96c-42.73-65.92-79.14-121.11-81.25-122.64-3.07-2.11-13.03-2.68-47.14-2.49-25.49 0-44.84.96-47.14 2.11z" />
    </svg>
);

const componentHeaderColor = "#F6F6EB";

registerActionComponents("Dashboard Specific", [
    {
        name: "CollectStream",
        icon: regexpIcon,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "data",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "stream",
                type: "expression",
                valueType: "any"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const streamValue = context.evalProperty("stream");

            if (streamValue) {
                if (
                    streamValue instanceof Readable ||
                    streamValue instanceof Duplex
                ) {
                    let accData = "";

                    context.startAsyncExecution();

                    streamValue.on("data", (data: Buffer) => {
                        accData += data.toString();
                        context.propagateValue("data", accData);
                    });

                    streamValue.on("end", (data: Buffer) => {
                        context.propagateValueThroughSeqout();
                        context.endAsyncExecution();
                    });
                } else {
                    //context.throwError("not a readable stream");
                }
            }

            return undefined;
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////
