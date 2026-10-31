---
title: 体系结构学习笔记
date: 2026-10-31
series: Inspiration
slug: riscv-datapath-learning-notes
description: 记录体系结构学习中的图解与简短笔记，持续补充。
author: Kugai Chen
language: zh-CN
---

# 体系结构学习笔记

## 单周期微体系结构

以 `lw x6, -4(x9)` 为例，梳理取指、寄存器读取、立即数扩展、地址计算、访存和写回。具体分析见图中标注。

![单周期微体系结构：lw 指令的数据通路与个人批注](figures/user-lw-datapath-enhanced.png)

[查看大图](figures/user-lw-datapath-enhanced.png)

补充说明：

- 本例为32位指令，顺序执行时PC加4；图中“每次+1”应改为“每次+4”。
- 图中编号是分析步骤，不代表时钟周期数。
- 最后一幅是下一条 `sw x6, 8(x9)` 指令，展示的是写内存路径。

## 从单周期到流水线

记录无停顿的五级流水线中，写回数据与目标寄存器编号必须保持对应的问题。具体分析见图中标注。

![单周期变流水线：目标寄存器编号随指令传递](figures/user-pipeline-writeback-enhanced.png)

[查看大图](figures/user-pipeline-writeback-enhanced.png)

注：图中的“写回地址”指目标寄存器编号 `rd`，不是数据内存地址；它需要随指令经过各级流水线寄存器。

图源：Harris《Digital Design and Computer Architecture: RISC-V Edition》相关教学数据通路，个人整理与批注。
