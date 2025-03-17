#/bin/bash

inputPath=/Users/yu-hung/Desktop/TestingGround/dev-SMAv4
SMAv4=/Users/yu-hung/Desktop/AccuinBio/Suspect-X/Nucleus/core/sma_v4.js

node ${SMAv4} \
 --smn1_std1 ${inputPath}/SMN1_20241121/20241121_SMN1_1_1_S1A02_R1.xlsx \
 --smn1_std2 ${inputPath}/SMN1_20241121/20241121_SMN1_2_2_S1A03_R1.xlsx \
 --smn1_std3 ${inputPath}/SMN1_20241121/20241121_SMN1_3_3_S1A04_R1.xlsx \
 --smn2_std1 ${inputPath}/SMN2_20241121/20241121_SMN2_1_1_S1C02_R1.xlsx \
 --smn2_std2 ${inputPath}/SMN2_20241121/20241121_SMN2_2_2_S1C03_R1.xlsx \
 --smn2_std3 ${inputPath}/SMN2_20241121/20241121_SMN2_3_3_S1C04_R1.xlsx \
 --smn1_sample ${inputPath}/SMN1_20241121/20241121_SMN1_0315-17_1_1_S1A07_R1.xlsx \
 --smn2_sample ${inputPath}/SMN2_20241121/20241121_SMN2_0315-17_1_1_S1C07_R1.xlsx \
 --smn1_sample ${inputPath}/SMN1_20241121/20241121_SMN1_0321-12_2_3_S1A05_R1.xlsx \
 --smn2_sample ${inputPath}/SMN2_20241121/20241121_SMN2_0321-12_2_3_S1C05_R1.xlsx \
 --smn1_sample ${inputPath}/SMN1_20241121/20241121_SMN1_0321-15_1_3_S1A06_R1.xlsx \
 --smn2_sample ${inputPath}/SMN2_20241121/20241121_SMN2_0321-15_1_3_S1C06_R1.xlsx \
 --smn1_sample ${inputPath}/SMN1_20241121/20241121_SMN1_0321-20_1_3_S1A08_R1.xlsx \
 --smn2_sample ${inputPath}/SMN2_20241121/20241121_SMN2_0321-20_1_3_S1C08_R1.xlsx
