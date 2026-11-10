import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { expect, it } from "vitest";

it("renders Recharts children with React 19, including fragments", () => {
  const markup = renderToStaticMarkup(
    <BarChart width={400} height={250} data={[{ date: "Mon", green: 2 }]}>
      <XAxis dataKey="date" />
      <YAxis />
      <React.Fragment>
        <Bar dataKey="green" fill="#22c55e" isAnimationActive={false} />
      </React.Fragment>
    </BarChart>
  );
  expect(markup).toContain("recharts-surface");
  expect(markup).toContain("recharts-bar-rectangle");
  expect(markup).toContain("#22c55e");
  expect(markup).toContain("Mon");
});
