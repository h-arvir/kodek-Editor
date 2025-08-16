import React, { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { motion } from "framer-motion";
import { useTheme } from "../src/context/theme";

const StaggeredDropDown = ({ language, setLanguage, languageOptions }) => {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <motion.div animate={open ? "open" : "closed"} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300 ${
          isDark
            ? "text-white bg-purple-700 hover:bg-purple-600"
            : "text-gray-800 border border-pink-300/40 hover:border-pink-300/80 shadow-sm hover:shadow-md"
        }`}
        style={
          !isDark
            ? {
                backgroundColor: "rgba(255, 232, 147, 0.7)",
                "--tw-shadow": "0 2px 8px rgba(251, 180, 165, 0.15)",
              }
            : {}
        }
        onMouseEnter={(e) => {
          if (!isDark) {
            e.target.style.backgroundColor = "rgba(255, 232, 147, 0.9)";
            e.target.style.boxShadow = "0 0 12px rgba(251, 180, 165, 0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDark) {
            e.target.style.backgroundColor = "rgba(255, 232, 147, 0.7)";
            e.target.style.boxShadow = "0 2px 8px rgba(251, 180, 165, 0.15)";
          }
        }}
      >
        <span className="font-medium text-sm">{language}</span>
        <motion.span variants={iconVariants}>
          <FiChevronDown />
        </motion.span>
      </button>

      <motion.ul
        initial={wrapperVariants.closed}
        variants={wrapperVariants}
        style={{ originY: "top", translateX: "-50%" }}
        className={`flex flex-col gap-2 p-2 rounded-lg shadow-xl absolute top-[120%] left-[50%] w-48 overflow-hidden ${
          isDark
            ? "bg-[#2a223a] text-white"
            : "bg-white text-gray-800 border border-pink-200"
        }`}
      >
        {Object.keys(languageOptions).map((lang) => (
          <Option
            key={lang}
            setOpen={setOpen}
            text={lang.charAt(0).toUpperCase() + lang.slice(1)}
            isDark={isDark}
            onClick={() => {
              setLanguage(lang);
            }}
          />
        ))}
      </motion.ul>
    </motion.div>
  );
};

const Option = ({ text, setOpen, onClick, isDark }) => {
  return (
    <motion.li
      variants={itemVariants}
      onClick={() => {
        setOpen(false);
        onClick(); // Execute the language change when clicked
      }}
      className={`cursor-pointer flex items-center gap-2 w-full p-2 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
        isDark
          ? "hover:bg-purple-800 text-white hover:text-purple-300"
          : "hover:bg-pink-50 text-gray-800 hover:text-pink-600"
      }`}
      >
      <span>{text}</span>
    </motion.li>
  );
};

export default StaggeredDropDown;

// Animation variants (same as the ones you provided)
const wrapperVariants = {
  open: {
    scaleY: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
  closed: {
    scaleY: 0,
    transition: {
      when: "afterChildren",
      staggerChildren: 0.1,
    },
  },
};

const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
};

const itemVariants = {
  open: {
    opacity: 1,
    y: 0,
    transition: {
      when: "beforeChildren",
    },
  },
  closed: {
    opacity: 0,
    y: -15,
    transition: {
      when: "afterChildren",
    },
  },
};
