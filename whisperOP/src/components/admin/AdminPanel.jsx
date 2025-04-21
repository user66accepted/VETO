import React, { useEffect, useState } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import chartjsPluginAnnotation from 'chartjs-plugin-annotation';
import DevMods from "../pages/DevMods";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler,
    chartjsPluginAnnotation,
);


const AdminPanel = () => {
    const [metrics, setMetrics] = useState(null);
    const [cpuData, setCpuData] = useState(Array(60).fill(0));
    const [memoryData, setMemoryData] = useState(Array(60).fill(0));


    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await fetch("http://192.168.15.41:5000/admin/metrics");
                const data = await response.json();
                setMetrics(data);

                // Update CPU data (shift old data and add new point)
                setCpuData((prev) => [...prev.slice(1), data.cpuUsage * 100]);
                setMemoryData((prev) => [...prev.slice(1), data.memoryUsage.percentage]);
            } catch (error) {
                console.error("Failed to fetch metrics:", error);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 1000); // Update every second
        return () => clearInterval(interval);
    }, []);

    if (!metrics) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <h1 className="text-xl font-semibold text-gray-700">Loading metrics...</h1>
            </div>
        );
    }

    const { totalRequests, successfulRequests, failedRequests, uptime, activeRequests, queuedRequests } = metrics;


    const lineChartData = {
        labels: Array.from({ length: 60 }, (_, i) => `${60 - i}s`), // 60 seconds rolling
        datasets: [
            {
                label: "CPU Usage (%)",
                data: cpuData,
                borderColor: "#3B82F6", // Line color (default blue)
                backgroundColor: 'transparent', // No background fill
                fill: false, // Disable area fill
                lineTension: 0.4, // Optional: smooth the line
            },
        ],
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disable animations for live updates
        plugins: {
            legend: {
                labels: {
                    color: "#FFFFFF", // Set legend text to white
                },
            },
            annotation: {
                annotations: {
                    greenBand: {
                        type: 'box',
                        yMin: 0,
                        yMax: 40,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green background for 0-40%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                    yellowBand: {
                        type: 'box',
                        yMin: 40,
                        yMax: 80,
                        backgroundColor: 'rgba(234, 179, 8, 0.2)', // Yellow background for 40-80%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                    redBand: {
                        type: 'box',
                        yMin: 80,
                        yMax: 100,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)', // Red background for 80-100%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: "#FFFFFF", // Set x-axis labels to white
                },
            },
            y: {
                min: 0,
                max: 100,
                ticks: {
                    stepSize: 20,
                    color: "#FFFFFF", // Set y-axis labels to white
                },
            },
        },
    };


    const donutChartData = {
        labels: ["Successful Requests", "Failed Requests"],
        datasets: [
            {
                data: [successfulRequests, failedRequests],
                backgroundColor: ["#10B981", "#EF4444"], // Green and Red
                hoverBackgroundColor: ["#059669", "#DC2626"],
            },
        ],
    };

    const donutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#FFFFFF", // Set legend text to white
                },
            },
            tooltip: {
                callbacks: {
                    label: (tooltipItem) => {
                        const value = tooltipItem.raw;
                        const total = totalRequests || 1; // Avoid division by zero
                        const percentage = ((value / total) * 100).toFixed(2);
                        return `${tooltipItem.label}: ${value} (${percentage}%)`;
                    },
                },
            },
        },
    };

    const memoryChartData = {
        labels: Array.from({ length: 60 }, (_, i) => `${60 - i}s`), // 60 seconds rolling
        datasets: [
            {
                label: "Memory Usage (%)",
                data: memoryData,
                borderColor: "#3B82F6", // Red color for the line
                backgroundColor: 'transparent', // No background fill
                fill: false, // Disable area fill
                lineTension: 0.4, // Optional: smooth the line
            },
        ],
    };

    const memoryChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disable animations for live updates
        plugins: {
            legend: {
                labels: {
                    color: "#FFFFFF",
                },
            },
            annotation: {
                annotations: {
                    greenBand: {
                        type: 'box',
                        yMin: 0,
                        yMax: 40,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green background for 0-40%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                    yellowBand: {
                        type: 'box',
                        yMin: 40,
                        yMax: 80,
                        backgroundColor: 'rgba(234, 179, 8, 0.2)', // Yellow background for 40-80%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                    redBand: {
                        type: 'box',
                        yMin: 80,
                        yMax: 100,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)', // Red background for 80-100%
                        borderColor: 'transparent', // No border
                        borderWidth: 0,
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: "#FFFFFF", // Set x-axis labels to white
                },
            },
            y: {
                min: 0,
                max: 100,
                ticks: {
                    stepSize: 20,
                    color: "#FFFFFF", // Set y-axis labels to white
                },
            },
        },
    };



    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <h1 className="text-4xl font-bold text-white mb-6">VETO Analytics & Controls</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ">
                {/* Memory Usage */}
                <div className="bg-gray-700 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-white mb-4 ">Memory Usage</h2>
                    <div className="h-64 w-full">
                        <Line
                            data={memoryChartData}
                            options={memoryChartOptions}
                        />
                    </div>
                </div>
                {/* CPU Usage */}
                <div className="bg-gray-700 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">CPU Usage</h2>
                    <div className="h-64 w-full">
                        <Line
                            data={lineChartData}
                            options={lineChartOptions}
                        />
                    </div>
                </div>
            </div>
            <div className="flex w-full gap-6 mt-8">
                {/* Requests Stats */}
                <div className="bg-gray-700 rounded-lg shadow-md p-6 w-1/3">
                    <h2 className="text-xl font-semibold text-white mb-4">Request Stats</h2>
                    <div className="flex h-64 w-full mt-8">
                        <div className="w-1/2 gap-2 text-white">
                            <h1 className="flex gap-3">Total requests: <p>{totalRequests}</p></h1>
                            <h1 className="flex gap-3">Active requests: <p>{activeRequests}</p></h1>
                            <h1 className="flex gap-3">Queued requests: <p>{queuedRequests}</p></h1>
                            <h1 className="flex gap-3">Successful requests: <p>{successfulRequests}</p></h1>
                            <h1 className="flex gap-3">Failed requests: <p>{failedRequests}</p></h1>
                        </div>
                        <div className="w-1/2">
                            <Doughnut
                                data={donutChartData}
                                options={donutChartOptions}
                            />
                        </div>
                    </div>
                </div>

                {/* Uptime and Request Logs */}
                <div className="bg-gray-700 rounded-lg shadow-md p-6 w-1/3">
                    <h2 className="text-xl font-semibold text-white mb-4">Server Details</h2>
                    <p className="text-white mb-2">
                        <strong>Uptime:</strong> {uptime}
                    </p>

                    {/* Request Logs */}
                    <h3 className="text-lg font-semibold text-white mb-2">Request Logs</h3>
                    <div
                        className="bg-gray-900 rounded-lg p-3 h-64 overflow-y-auto text-sm text-white font-mono"
                        style={{ border: "1px solid #374151" }}
                    >
                        {metrics.requestLogs && metrics.requestLogs.length > 0 ? (
                            metrics.requestLogs.slice(-50).map((log, index) => (
                                <div key={index}>
                                    <span className="text-red-600">server@Ubuntu:~$ </span><span className="text-green-400">{log.timestamp}:</span> {log.error} {log.url} {log.text}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400"><span className="text-red-600">server@Ubuntu:~$ </span>No logs available.</p>
                        )}
                    </div>
                </div>
                {/*Error Logs */}
                <div className="bg-gray-700 rounded-lg shadow-md p-6 w-1/3">
                    <h2 className="text-xl font-semibold text-white mb-4">Server Details</h2>
                    <p className="flex gap-3 text-white mb-2">
                        <strong>Server resources:</strong> <p className="font-bold text-green-600">Stable</p>
                    </p>
                    {/* Request Logs */}
                    <h3 className="text-lg font-semibold text-white mb-2">Error Logs</h3>
                    <div
                        className="bg-gray-900 rounded-lg p-3 h-64 overflow-y-auto text-sm text-white font-mono"
                        style={{ border: "1px solid #374151" }}
                    >
                        {metrics.errorLogs && metrics.errorLogs.length > 0 ? (
                            metrics.errorLogs.slice(-50).map((log, index) => (
                                <div key={index}>
                                    <span className="text-red-600">server@Ubuntu:~$ </span><span className="text-green-400">{log.timestamp}:</span> {log.method} {log.url} {log.error} {log.text}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400"><span className="text-red-600">server@Ubuntu:~$ </span>No logs available.</p>
                        )}
                    </div>
                </div>
            </div>
            <DevMods />
        </div>
    );
};

export default AdminPanel;
